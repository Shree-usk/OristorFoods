---
name: add-recipe
description: Create or update a recipe, including the recipe database model, admin recipe builder fields, and the storefront recipe detail page. Use when adding a new recipe, recipe field, or recipe-related feature.
---

# Add Recipe

## 1. Database
- Recipe model fields: category, preparation time, cooking time,
  difficulty, servings, ingredients, cooking steps, chef tips, nutrition,
  linked products ("Products Used"), video, images, downloads (PDF), SEO
  fields.
- Recipes go through a publishing workflow: Draft → Review → Approval →
  Published → Archived. Model this as a status enum, not a boolean.

## 2. Backend
- Recipe Service handles CRUD + status transitions. Automatic product
  linking: when a recipe references a product, store the relation so the
  product page can show "Recipes Using This Product."

## 3. Admin Console (Recipe Builder)
- Support drag-and-drop reordering of cooking steps.
- Rich text editing for steps/chef tips.
- Image and video upload via the Media Library.
- PDF attachment support.
- Recipe Q&A and Recipe Reviews are separate from the recipe content
  itself — link to those modules, don't duplicate their logic.

## 4. Storefront
- Recipe Detail Page: ingredients list, step-by-step instructions, chef
  tips, nutrition, video, linked products with add-to-cart, reviews, Q&A,
  bookmark/save action.
- Recipe Centre listing page: filter by category, difficulty, prep time.

## 5. SEO
- Recipe schema (JSON-LD) is required — this is a specific structured data
  type, not generic Article schema.

## 6. Tests
- Unit test the publishing workflow transitions.
- E2E test: browse recipe → view detail → add linked product to cart.

## 7. Docs
- Update recipe module docs if the data model changes.
