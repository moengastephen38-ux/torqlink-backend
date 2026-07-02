 import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { stkPush } from '../services/mpesa';

const PLATFORM_COMMISSION = 0.15;     // 15% commission on job payments
const LISTING_FEE = 500;              // KES per car listing
const SHOP_SUBSCRIPTION_FEE = 1000;   // KES per month per shop

/**
 * INITIATE PAYMENT (Job payout)
 * Driver pays a mechanic for a resolved breakdown/service job.
 * Funds are split 85% mechanic / 15% platform commission.
 */
export const initiatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId, amount, phone } = req.body;

  if (!serviceRequestId || !amount || !phone) {
    res.status(400).json({ error: 'serviceRequestId, amount and phone are required' });
    return;
  }

  try {
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: { id: serviceRequestId, driverId: req.userId },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    if (serviceRequest.status !== 'RESOLVED') {
      res.status(400).json({ error: 'Payment can only be made for resolved requests' });
      return;
    }

    const commission = amount * PLATFORM_COMMISSION;
    const mechanicPayout = amount - commission;

    const stkResponse = await stkPush(phone, amount, serviceRequestId);

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        commission,
        mechanicPayout,
        phoneNumber: phone,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        serviceRequestId,
        driverId: req.userId as string,
        mechanicId: serviceRequest.mechanicId,
      },
    });

    res.status(201).json({
      message: 'Payment initiated. Check your phone for M-Pesa prompt.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      transaction,
    });
  } catch (error: any) {
    console.error(error?.response?.data || error);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};

/**
 * PAY FOR CAR LISTING
 * Seller pays a one-time fee to publish a dealership listing.
 * The Transaction is linked to the listing via serviceRequestId (reused field).
 */
export const payForListing = async (req: AuthRequest, res: Response): Promise<void> => {
  const { listingId, phone } = req.body;

  if (!listingId || !phone) {
    res.status(400).json({ error: 'listingId and phone are required' });
    return;
  }

  try {
    const listing = await prisma.dealershipListing.findFirst({
      where: { id: listingId, sellerId: req.userId },
    });

    if (!listing) {
      res.status(404).json({ error: 'Listing not found or does not belong to you' });
      return;
    }

    if (listing.isPaid) {
      res.status(400).json({ error: 'This listing is already paid and live' });
      return;
    }

    const stkResponse = await stkPush(phone, LISTING_FEE, listingId);

    await prisma.transaction.create({
      data: {
        amount: LISTING_FEE,
        commission: LISTING_FEE, // 100% platform fee, no payout
        mechanicPayout: 0,
        phoneNumber: phone,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        serviceRequestId: listingId, // reused field — links back to the listing
        driverId: req.userId as string,
      },
    });

    res.status(201).json({
      message: 'Payment initiated. Check your phone to complete the listing fee.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });
  } catch (error: any) {
    console.error(error?.response?.data || error);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};

/**
 * PAY FOR SHOP SUBSCRIPTION
 * Shop owner pays a monthly fee to keep their parts visible in search.
 */
export const payForShopSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  const { shopId, phone } = req.body;

  if (!shopId || !phone) {
    res.status(400).json({ error: 'shopId and phone are required' });
    return;
  }

  try {
    const shop = await prisma.partShop.findFirst({
      where: { id: shopId, ownerId: req.userId },
    });

    if (!shop) {
      res.status(404).json({ error: 'Shop not found or does not belong to you' });
      return;
    }

    const stkResponse = await stkPush(phone, SHOP_SUBSCRIPTION_FEE, shopId);

    await prisma.transaction.create({
      data: {
        amount: SHOP_SUBSCRIPTION_FEE,
        commission: SHOP_SUBSCRIPTION_FEE,
        mechanicPayout: 0,
        phoneNumber: phone,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        serviceRequestId: shopId, // reused field — links back to the shop
        driverId: req.userId as string,
      },
    });

    res.status(201).json({
      message: 'Payment initiated. Check your phone to activate your shop subscription.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });
  } catch (error: any) {
    console.error(error?.response?.data || error);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};

/**
 * M-PESA CALLBACK WEBHOOK
 * Safaricom hits this URL after the user enters their PIN.
 * Routes the result to the correct place depending on what was paid for:
 *  1. Job payout      -> has mechanicId -> credits mechanic wallet
 *  2. Car listing fee -> serviceRequestId matches a DealershipListing -> marks isPaid
 *  3. Shop subscription -> serviceRequestId matches a PartShop -> activates subscription
 */
export const mpesaCallback = async (req: any, res: Response): Promise<void> => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    const transaction = await prisma.transaction.findFirst({
      where: { checkoutRequestId: CheckoutRequestID },
    });

    if (!transaction) {
      res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      return;
    }

    if (ResultCode === 0) {
      const mpesaReceiptNumber = CallbackMetadata?.Item?.find(
        (item: any) => item.Name === 'MpesaReceiptNumber'
      )?.Value;

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', mpesaReceiptNumber },
      });

      if (transaction.mechanicId) {
        // Case 1: Job payout — credit the mechanic's wallet
        const wallet = await prisma.wallet.findUnique({
          where: { mechanicId: transaction.mechanicId },
        });

        if (wallet) {
          await prisma.wallet.update({
            where: { mechanicId: transaction.mechanicId },
            data: {
              balance: wallet.balance + transaction.mechanicPayout,
              totalEarned: wallet.totalEarned + transaction.mechanicPayout,
            },
          });
        } else {
          await prisma.wallet.create({
            data: {
              mechanicId: transaction.mechanicId,
              balance: transaction.mechanicPayout,
              totalEarned: transaction.mechanicPayout,
            },
          });
        }
      } else {
        // Case 2 or 3: No mechanicId — check if it's a listing fee or shop subscription
        const listing = await prisma.dealershipListing.findUnique({
          where: { id: transaction.serviceRequestId },
        });

        if (listing) {
          await prisma.dealershipListing.update({
            where: { id: listing.id },
            data: { isPaid: true, listingFeePaid: transaction.amount },
          });
        } else {
          const shop = await prisma.partShop.findUnique({
            where: { id: transaction.serviceRequestId },
          });

          if (shop) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);

            await prisma.partShop.update({
              where: { id: shop.id },
              data: { subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: expiresAt },
            });
          }
        }
      }
    } else {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error(error);
    // Always respond 200 to Safaricom even on internal errors, or they will retry endlessly
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

/**
 * GET PAYMENT STATUS
 * Driver checks the status of a specific job payment.
 */
export const getPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId } = req.params;

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { serviceRequestId },
    });

    if (!transaction) {
      res.status(404).json({ error: 'No transaction found for this request' });
      return;
    }

    res.json({ transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET WALLET
 * Mechanic checks their wallet balance and total earnings.
 */
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { mechanicId: req.userId },
    });

    if (!wallet) {
      res.json({ wallet: { balance: 0, totalEarned: 0, pendingClearance: 0 } });
      return;
    }

    res.json({ wallet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};