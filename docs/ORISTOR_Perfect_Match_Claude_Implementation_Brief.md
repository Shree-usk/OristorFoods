# ORISTOR HOMEPAGE -- THE PERFECT MATCH

## UI/UX Implementation & Admin CMS Integration Brief

### 1. Objective

Implement the approved **ORISTOR -- The Perfect Match** homepage section
into the existing ORISTOR website.

Approved visual prototype: `oristor-perfect-match-prototype.html`

This section must appear immediately **after the existing Export /
Global Distribution section** on the homepage.

The purpose is to demonstrate how ORISTOR condiments can transform
familiar everyday meals through delicious food pairings.

This is a premium brand-experience section, not a conventional product
grid.

**Core message: Ordinary Meals. Extraordinary Flavours.**

### 2. Critical design instruction -- follow the approved prototype

Study the supplied HTML prototype carefully before writing any code. Use
it as the primary visual and interaction reference.

Retain its design direction:

-   Elegant editorial-style headings.
-   Warm cream background.
-   Deep charcoal typography.
-   ORISTOR signature red accents.
-   Premium product presentation.
-   Large, attractive food photography.
-   Rounded, refined cards.
-   Generous spacing.
-   Subtle borders and shadows.
-   Smooth product-selection transitions.
-   Responsive product selector.
-   Four food-pairing cards.

Do not simplify the design into ordinary Bootstrap cards or a basic
four-column product grid.

Do not replace the approved layout with your own interpretation.

You may improve implementation quality, accessibility and
responsiveness, but the visual character and experience must remain
faithful to the prototype.

### 3. Text readability -- highest priority

Previous UI implementations have sometimes lost their visual elegance
because headings, descriptions and supporting text became too small, too
light or visually crowded.

This must not happen here.

Treat typography as a primary design element, not a finishing detail.

  Element                       Desktop target   Mobile target
  --------------------------- ---------------- ---------------
  Main section heading                42--52px        32--36px
  Featured product heading            36--44px        29--33px
  Pairing section heading             26--30px        23--26px
  Pairing card title                  19--21px        16--18px
  Body descriptions                   15--16px        14--15px
  Eyebrow / category labels           11--13px        11--12px
  Buttons                             13--15px        13--14px

These are design targets, not rigid constraints.

Typography requirements:

-   Use Playfair Display or the site's established editorial serif font
    for prominent headings.
-   Use Inter, DM Sans or the existing website body font for supporting
    text.
-   Maintain strong contrast between text and background.
-   Avoid excessively thin font weights.
-   Use comfortable line heights, particularly for descriptions.
-   Do not truncate important product descriptions.
-   Avoid tiny uppercase text for essential information.
-   Ensure headings remain readable at normal desktop viewing distance.
-   Maintain consistent font sizes and weights across all four pairing
    cards.
-   Never allow text to overlap images or buttons.
-   Avoid excessive letter spacing in body text.

The entire section should look clear, confident, premium and easy to
read.

### 4. Section layout and content

#### A. Introduction

Use the following approved content:

**Eyebrow:**\
A LITTLE INSPIRATION FROM OUR KITCHEN

**Main heading:**\
Ordinary Meals. Extraordinary Flavours.

**Description:**\
Discover how a spoonful of ORISTOR can transform the meals you already
love. Choose a favourite and find its perfect match.

Keep this introduction centred with a comfortable maximum width and
generous vertical spacing.

#### B. Product selector

Create interactive product-selection tabs.

Initial products:

1.  Garlic Curry
2.  Muringa
3.  Onion Thokku
4.  Mango Pickle
5.  Seeni Sambol

Requirements:

-   Garlic Curry selected initially.
-   Selected tab uses ORISTOR red.
-   Unselected tabs use subtle borders and neutral text.
-   Smooth hover and active states.
-   Clicking a tab updates the featured product and all four meal
    pairings.
-   On mobile, allow horizontal scrolling without breaking the layout.
-   Keep product names clearly visible.

Product selection must not reload the page.

#### C. Featured product presentation

Use the two-column layout from the prototype.

**Left:**

-   Large product image.
-   Premium neutral background.
-   Proper product proportions.
-   Soft shadow.
-   Refined image presentation.

**Right:**

-   Product category/kicker.
-   Product name.
-   Short product description.
-   Number of meal pairings.
-   Explore this product button.
-   Discover all products link.

Use the actual ORISTOR product image from the existing media library or
product database.

Do not generate replacement packaging artwork or alter existing labels.

Preserve product photographs, branding, packaging, proportions and
colours.

#### D. Four meal-pairing cards

Below the featured product, show exactly four pairing cards.

Use the heading:

**MADE FOR YOUR TABLE**

Dynamic heading example:

**Garlic Curry, four ways.**

Each card must contain:

-   Large, high-quality food photograph.
-   Pairing number or subtle category label.
-   Clear meal title.
-   Short appetising description.
-   Optional small supporting tag.

Use a consistent card height and image ratio.

All four cards should align neatly on desktop.

Use smooth, subtle hover effects, such as:

-   Slight image zoom.
-   Small elevation.
-   Soft shadow.
-   Gentle border transition.

Avoid exaggerated animations.

The food photography must be relevant to the actual meal pairing. Do not
use generic or unrelated food photographs.

### 5. Product and meal content

Use the following as initial editorial content, subject to product and
recipe accuracy.

**Garlic Curry** - Sri Lankan Rotti - Fresh Bread - Steamed Rice -
String Hoppers

**Muringa** - Steamed Rice - String Hoppers - Warm Rotti - Rice and
Curry

**Onion Thokku** - Crisp Dosa - Fresh Bread - Steamed Rice - Warm Rotti

**Mango Pickle** - Rice and Curry - Coconut Rotti - Curd and Rice -
Sandwiches

**Seeni Sambol** - Milk Rice - Hoppers - Sandwiches - Rotti

Descriptions should communicate appetite, tradition and the pleasure of
eating.

Avoid unsupported health claims or inaccurate product ingredients.

All content must be editable through the admin panel.

### 6. Visual smoothness and interaction quality

The section should feel polished and fluid.

Implement:

-   Smooth transitions when selecting another product.
-   Subtle fade/slide transition for the featured product content.
-   Consistent hover transitions on pairing cards.
-   Smooth horizontal scrolling on mobile.
-   Responsive image loading.
-   Appropriate image aspect ratios.
-   No sudden layout jumps when content changes.
-   No unnecessary animation that affects performance.

Avoid:

-   Flashing content.
-   Abrupt image replacement.
-   Excessive shadows.
-   Overly rounded cards.
-   Heavy animation libraries for simple interactions.
-   Inconsistent spacing between product states.

Respect reduced-motion accessibility preferences.

### 7. Admin panel -- hybrid content management

This section must be fully manageable through the existing ORISTOR admin
panel.

Do not hardcode the final product list or meal-pairing content into the
frontend.

#### Product management

Integrate with the existing product database.

Administrators must be able to:

-   Select existing products for this section.
-   Enable or disable a product.
-   Change display order.
-   Select the default featured product.
-   Edit the short promotional description if appropriate.
-   Use the existing product image.
-   Preview the selected product.

Do not create duplicate product records.

Use existing product IDs and relationships.

#### Meal-pairing management

Create a separate manageable relationship between products and meal
pairings.

Each pairing should support:

-   Pairing title.
-   Short description.
-   Food photograph.
-   Display order.
-   Optional category/tag.
-   Active/inactive status.
-   Associated product ID.

Allow administrators to add, edit, delete and reorder pairings.

Enforce a maximum of four active pairings per product for this homepage
experience.

#### Publishing controls

Provide:

-   Draft / Published status.
-   Preview before publishing.
-   Save changes.
-   Publish changes.
-   Unpublish.
-   Product ordering.
-   Pairing ordering.

The frontend must only display published and active content.

Handle products with no available pairings gracefully.

### 8. Homepage integration

Place this section immediately after the existing Export / Global
Distribution section.

Preserve:

-   Existing website header.
-   Existing navigation.
-   Existing homepage sections.
-   Existing footer.
-   Existing Instagram section and its current placement.
-   Existing global colour and typography tokens wherever appropriate.

Do not redesign the header or footer.

Do not insert a second footer.

Do not introduce an unnecessary section heading or promotional banner
above this component.

Use the existing site's content container and spacing system where
appropriate, while preserving the approved prototype's visual
proportions.

### 9. Responsive behaviour

**Desktop:** - Centred introduction. - Horizontal product selector. -
Two-column featured product. - Four pairing cards in one row.

**Tablet:** - Maintain the featured product layout where space allows. -
Otherwise stack product image and description elegantly. - Use two
pairing cards per row.

**Mobile:** - Stack the featured product image and copy. - Keep buttons
accessible. - Product selector scrolls horizontally. - Pairing cards may
appear two per row if text remains comfortably readable; use one column
when necessary. - Avoid horizontal page overflow. - Ensure descriptions
and card titles are never too small.

### 10. Technical and implementation safeguards

Before implementation:

1.  Inspect the existing homepage architecture.
2.  Identify the Export section component.
3.  Inspect existing product models, image storage and product routes.
4.  Inspect the current admin panel architecture and permission system.
5.  Identify the existing CMS conventions.
6.  Review existing design tokens and reusable components.

Use the existing technology stack, patterns and conventions.

Do not introduce unnecessary dependencies.

Do not duplicate existing product data.

Do not break existing product URLs, navigation, homepage sections or
admin permissions.

Use appropriate validation, sanitisation and image upload restrictions.

Use efficient image loading and avoid loading all hidden product images
unnecessarily.

Ensure keyboard accessibility and semantic HTML.

### 11. Testing and acceptance criteria

The implementation is not complete until all the following are verified:

-   The section appears immediately after Export.
-   Its appearance closely matches the approved HTML prototype.
-   Typography is clear and visually prominent.
-   All five products can be selected.
-   Selecting a product updates the featured product and all four
    pairings.
-   Product images display correctly.
-   Pairing photographs match their descriptions.
-   Product links navigate to the correct existing product pages.
-   Admin can manage products and meal pairings.
-   Admin can upload and reorder images.
-   Admin can preview and publish changes.
-   Mobile and tablet layouts work properly.
-   Existing homepage sections remain unchanged.
-   Existing header and footer remain unchanged.
-   No console errors or broken images.
-   No regression to existing website functionality.

### 12. Execution approach

Work incrementally.

First, provide a short audit of the existing architecture and proposed
database changes.

Then implement the frontend component and verify its appearance against
the approved prototype.

Next, implement the admin management functionality and connect it to the
frontend.

Run the relevant tests and report the results.

Do not deploy to production without my explicit approval.

Do not make unrelated homepage or website changes.

### Final design directive

I do not want a basic functional implementation that merely contains the
right elements.

I want the final result to preserve the elegance, editorial typography,
visual hierarchy, whitespace, premium food presentation and smoothness
of the approved prototype.

The written content must be immediately readable. The food imagery must
be attractive and relevant. The product selector must feel responsive
and refined.

Every element should feel deliberately designed as part of a premium Sri
Lankan food brand.

The final implementation should look like a carefully art-directed
ORISTOR experience, not a collection of standard website cards.
