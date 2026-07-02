 import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getDistanceKm } from '../utils/haversine';

/**
 * SEARCH PARTS
 * Drivers/mechanics search for spare parts across all shops.
 * Filters: name/category text match, vehicle compatibility substring match.
 * Only shops with an ACTIVE subscription are returned (monetization gate).
 * Results are sorted by proximity to the user's current location.
 *
 * Query params:
 *  - latitude, longitude (required)  -> user's current position
 *  - query    (optional) -> matches part name or category
 *  - vehicle  (optional) -> matches against the compatibility string
 *  - radiusKm (optional, default 25) -> max search radius
 */
export const searchParts = async (req: AuthRequest, res: Response): Promise<void> => {
  const { latitude, longitude, query, vehicle, radiusKm = 25 } = req.query;

  if (!latitude || !longitude) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  const lat = parseFloat(latitude as string);
  const lng = parseFloat(longitude as string);
  const radius = parseFloat(radiusKm as string);

  try {
    const textFilters: any[] = [];

    if (query) {
      textFilters.push({
        OR: [
          { name: { contains: query as string, mode: 'insensitive' } },
          { category: { contains: query as string, mode: 'insensitive' } },
        ],
      });
    }

    if (vehicle) {
      textFilters.push({
        compatibility: { contains: vehicle as string, mode: 'insensitive' },
      });
    }

    // Only show parts from shops with an active subscription
    const parts = await prisma.partItem.findMany({
      where: {
        AND: [
          ...textFilters,
          { shop: { subscriptionStatus: 'ACTIVE' } },
        ],
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    const results = parts
      .map((part) => {
        const distanceKm = getDistanceKm(lat, lng, part.shop.latitude, part.shop.longitude);
        return { ...part, distanceKm: parseFloat(distanceKm.toFixed(2)) };
      })
      .filter((part) => part.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ count: results.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET NEARBY CARS
 * Fetches dealership listings sorted by proximity, with optional filters.
 * Only listings with isPaid = true are returned (monetization gate).
 *
 * Query params:
 *  - latitude, longitude (required)
 *  - minPrice, maxPrice (optional)
 *  - make (optional)            -> case-insensitive partial match
 *  - condition (optional)       -> BRAND_NEW | FOREIGN_USED | LOCAL_USED
 *  - transmission (optional)    -> AUTOMATIC | MANUAL
 *  - radiusKm (optional, default 50)
 */
export const getNearbyCars = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    latitude, longitude,
    minPrice, maxPrice,
    make, condition, transmission,
    radiusKm = 50,
  } = req.query;

  if (!latitude || !longitude) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  const lat = parseFloat(latitude as string);
  const lng = parseFloat(longitude as string);
  const radius = parseFloat(radiusKm as string);

  try {
    const where: any = { status: 'AVAILABLE', isPaid: true };

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    if (make) {
      where.make = { contains: make as string, mode: 'insensitive' };
    }

    if (condition) {
      where.condition = condition as string;
    }

    if (transmission) {
      where.transmission = transmission as string;
    }

    const listings = await prisma.dealershipListing.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    const results = listings
      .map((listing) => {
        const distanceKm = getDistanceKm(lat, lng, listing.latitude, listing.longitude);
        return { ...listing, distanceKm: parseFloat(distanceKm.toFixed(2)) };
      })
      .filter((listing) => listing.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ count: results.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * MANAGE SHOP INVENTORY
 * For SELLER (or ADMIN) roles to create/update/toggle stock of parts
 * inside their own PartShop. A SELLER may own multiple shops, so the
 * shopId must always belong to the authenticated user.
 *
 * Actions (via req.body.action):
 *  - "createShop"   -> creates a new PartShop owned by the user
 *  - "addPart"      -> adds a PartItem to one of the user's shops
 *  - "updatePart"   -> updates fields of an existing PartItem
 *  - "toggleStock"  -> flips stockStatus between IN_STOCK / OUT_OF_STOCK
 */
export const manageShopInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  const { action } = req.body;

  try {
    switch (action) {
      case 'createShop': {
        const { name, description, latitude, longitude, address, phone } = req.body;

        if (!name || latitude === undefined || longitude === undefined) {
          res.status(400).json({ error: 'name, latitude and longitude are required' });
          return;
        }

        const shop = await prisma.partShop.create({
          data: {
            name,
            description,
            latitude,
            longitude,
            address,
            phone,
            ownerId: req.userId as string,
          },
        });

        res.status(201).json({
          message: 'Shop created successfully. Pay the subscription fee to make it visible to drivers.',
          shop,
        });
        return;
      }

      case 'addPart': {
        const { shopId, name, category, price, condition, compatibility, stockStatus, description } = req.body;

        if (!shopId || !name || price === undefined || !compatibility) {
          res.status(400).json({ error: 'shopId, name, price and compatibility are required' });
          return;
        }

        const shop = await prisma.partShop.findFirst({
          where: { id: shopId, ownerId: req.userId },
        });

        if (!shop) {
          res.status(404).json({ error: 'Shop not found or does not belong to you' });
          return;
        }

        const part = await prisma.partItem.create({
          data: {
            shopId,
            name,
            category,
            price,
            condition: condition || 'NEW',
            compatibility,
            stockStatus: stockStatus || 'IN_STOCK',
            description,
          },
        });

        res.status(201).json({ message: 'Part added successfully', part });
        return;
      }

      case 'updatePart': {
        const { partId, ...updateFields } = req.body;

        if (!partId) {
          res.status(400).json({ error: 'partId is required' });
          return;
        }

        const part = await prisma.partItem.findUnique({
          where: { id: partId },
          include: { shop: true },
        });

        if (!part || part.shop.ownerId !== req.userId) {
          res.status(404).json({ error: 'Part not found or does not belong to you' });
          return;
        }

        const allowedFields = ['name', 'category', 'price', 'condition', 'compatibility', 'stockStatus', 'description'];
        const data: any = {};
        for (const key of allowedFields) {
          if (updateFields[key] !== undefined) data[key] = updateFields[key];
        }

        const updated = await prisma.partItem.update({
          where: { id: partId },
          data,
        });

        res.json({ message: 'Part updated successfully', part: updated });
        return;
      }

      case 'toggleStock': {
        const { partId } = req.body;

        if (!partId) {
          res.status(400).json({ error: 'partId is required' });
          return;
        }

        const part = await prisma.partItem.findUnique({
          where: { id: partId },
          include: { shop: true },
        });

        if (!part || part.shop.ownerId !== req.userId) {
          res.status(404).json({ error: 'Part not found or does not belong to you' });
          return;
        }

        const newStatus = part.stockStatus === 'IN_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK';

        const updated = await prisma.partItem.update({
          where: { id: partId },
          data: { stockStatus: newStatus },
        });

        res.json({ message: `Stock status updated to ${newStatus}`, part: updated });
        return;
      }

      default:
        res.status(400).json({
          error: 'Invalid action. Use one of: createShop, addPart, updatePart, toggleStock',
        });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET MY SHOPS
 * Returns all shops (with their parts) owned by the authenticated user,
 * including subscription status so the frontend can prompt payment if needed.
 */
export const getMyShops = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shops = await prisma.partShop.findMany({
      where: { ownerId: req.userId },
      include: { parts: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ shops });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * CREATE CAR LISTING
 * Allows DRIVER, MECHANIC, SELLER (or ADMIN) roles to post a vehicle for sale.
 * The listing is created as isPaid: false (default) — it stays invisible
 * to other users until the listing fee is paid via /api/payments/listing-fee.
 */
export const createCarListing = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    title, make, model, year, price,
    condition, transmission, mileage,
    description, latitude, longitude, images,
  } = req.body;

  if (!title || !make || !model || !year || !price || latitude === undefined || longitude === undefined) {
    res.status(400).json({
      error: 'title, make, model, year, price, latitude and longitude are required',
    });
    return;
  }

  try {
    const listing = await prisma.dealershipListing.create({
      data: {
        title,
        make,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        condition: condition || 'LOCAL_USED',
        transmission: transmission || 'AUTOMATIC',
        mileage: mileage ? parseInt(mileage) : null,
        description,
        latitude,
        longitude,
        images: images || [],
        sellerId: req.userId as string,
      },
    });

    res.status(201).json({
      message: 'Listing created. Pay the listing fee to publish it to buyers.',
      listing,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET MY LISTINGS
 * Returns all dealership listings created by the authenticated user,
 * including unpaid/unpublished ones, so the seller can see what still
 * needs payment.
 */
export const getMyListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listings = await prisma.dealershipListing.findMany({
      where: { sellerId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ listings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * UPDATE LISTING STATUS
 * Lets a seller mark their own listing as RESERVED or SOLD (or back to AVAILABLE).
 */
export const updateListingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['AVAILABLE', 'RESERVED', 'SOLD'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  try {
    const listing = await prisma.dealershipListing.findFirst({
      where: { id, sellerId: req.userId },
    });

    if (!listing) {
      res.status(404).json({ error: 'Listing not found or does not belong to you' });
      return;
    }

    const updated = await prisma.dealershipListing.update({
      where: { id },
      data: { status },
    });

    res.json({ message: `Listing status updated to ${status}`, listing: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};