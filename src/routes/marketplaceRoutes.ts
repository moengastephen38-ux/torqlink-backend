import { Router } from 'express';
import {
  searchParts,
  getNearbyCars,
  manageShopInventory,
  getMyShops,
  createCarListing,
  getMyListings,
  updateListingStatus,
} from '../controllers/marketplaceController';
import { protect, requireRole } from '../middleware/authMiddleware';

const router = Router();

// ───────────── Spare Parts Marketplace ─────────────

// Public-to-authenticated search: any logged-in user (driver/mechanic) can search parts
router.get('/parts/search', protect, searchParts);

// Seller inventory management — create shops, add/update parts, toggle stock
router.post('/parts/inventory', protect, requireRole('SELLER', 'MECHANIC', 'ADMIN'), manageShopInventory);

// Seller views their own shops + inventory
router.get('/parts/my-shops', protect, requireRole('SELLER', 'MECHANIC', 'ADMIN'), getMyShops);

// ───────────── Car Dealership Marketplace ─────────────

// Any authenticated user can browse nearby car listings
router.get('/cars/nearby', protect, getNearbyCars);

// Any authenticated user (driver/mechanic/seller) can post a car for sale
router.post('/cars/create', protect, createCarListing);

// Seller views their own listings
router.get('/cars/my-listings', protect, getMyListings);

// Seller updates the status of their own listing (AVAILABLE / RESERVED / SOLD)
router.patch('/cars/:id/status', protect, updateListingStatus);

export default router;