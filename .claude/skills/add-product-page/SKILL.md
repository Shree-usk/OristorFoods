---
name: add-product-page
description: Create or update a product listing/detail page, including database fields, admin console fields, and storefront UI, following Oristor's product data model and design system. Use when adding a new product type, product field, or product-related page.
---

# Add Product Page

Follow this order — don't skip steps.

## 1. Database
- Add/update the Prisma model for the field or entity involved
  (`prisma/schema.prisma`). Products carry: SKU, barcode, slug, categories,
  collections, pricing tiers (standard/sale/wholesale/distributor/export),
  images, videos, ingredients, nutrition, allergens, certifications, SEO
  fields, reward points, related/cross-sell/upsell products.
- Run `npx prisma migrate dev` and confirm the migration is clean.

## 2. Backend
- Add the field/logic to the Product Service (never touch Prisma directly
  from a route handler — go through the Repository layer).
- Add Zod validation for any new input.

## 3. Admin Console
- Expose the field in the Product Management Console form (create/edit).
- If it's an image field, wire it through the Media Library, not a raw
  file upload.
- Confirm the field respects publishing status (Draft / Review /
  Published / Archived / Discontinued).

## 4. Storefront
- Update the Product Detail Page template. Every product page must include:
  gallery + zoom, product story, ingredients, nutrition, benefits, serving
  suggestions, related recipes, reviews, Q&A, related/recently viewed
  products, share buttons, availability, delivery info, reward points
  earned.
- Use existing shared components (image gallery, price display, add-to-cart
  button) — don't rebuild them.

## 5. SEO & Accessibility
- SEO title, meta description, slug, canonical URL, Open Graph, Product
  schema (JSON-LD).
- Alt text on every image, semantic headings.

## 6. Tests
- Unit test the service/validation logic.
- Add/update a Playwright test for the page render and add-to-cart flow.

## 7. Docs
- Note the new field/page in the relevant module doc if one exists.
