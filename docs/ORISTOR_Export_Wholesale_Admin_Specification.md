# ORISTOR Export & Wholesale Page and Admin Console

## Consolidated Product, Design, Catalogue, and Administration Specification

**Project:** ORISTOR Foods / Project Cinnamon\
**Target environment:** Approved development and staging workflow\
**Public reference:** https://staging.oristor.com/\
**Inspiration reference:** https://enrichtea.com/food-collection\
**Purpose:** Implement a branded export and wholesale page, its
product-selection/catalogue/enquiry features, and the necessary
management functions inside the existing ORISTOR Admin Console.

------------------------------------------------------------------------

## 1. Objective

Build an integrated **Export & Wholesale** experience that helps
overseas importers, distributors, supermarkets, wholesalers,
food-service buyers, and potential private-label partners discover
ORISTOR products and submit qualified enquiries.

The public page and Admin Console must use the existing project's
architecture and authoritative product data. The result must look like a
native part of the current ORISTOR website, not a separate generic B2B
portal.

Take inspiration from the collection-based product presentation and
buyer enquiry approach of the reference site, but **do not copy its
design or content**.

## 2. Mandatory First Step: Inspect Before Coding

Before modifying code:

1.  Inspect the repository structure, framework, routing, shared
    components, design tokens, fonts, header, navigation, footer, and
    responsive breakpoints.
2.  Inspect the current staging website if available. If it cannot be
    accessed, use the existing code and available screenshots as the
    source for its current design.
3.  Inspect existing product pages, product categories/collections,
    product images, database models, APIs, CMS, Admin Console, roles and
    permissions, media/storage architecture, enquiry/email services, PDF
    libraries, and audit logging.
4.  Inspect the project's existing Markdown specifications and
    implementation conventions. Find the most relevant documents for the
    public product page, Admin UI, CMS, Media Library, roles, and
    permissions.
5.  Identify which features already exist and should be reused. Do not
    create duplicate product management, media management, CMS, or admin
    infrastructure.
6.  Provide a concise implementation plan and list the
    files/models/routes expected to change before implementation.

Use the supplied HTML prototype, if available in the repository, as a
visual and functional reference only. The existing website's design
system and the requirements in this document take precedence.

## 3. Public Page Design: Match Existing ORISTOR

The new page must match the existing website's visual language,
including its logo, header, navigation, typography, button styles,
spacing, borders, card treatment, footer, and responsive behaviour.

Where consistent with the current site, use ORISTOR's warm ivory/white
backgrounds, charcoal text, and restrained red accents. Reuse existing
design tokens rather than introducing an independent design system.

Suggested hero headline:

**A Taste of Sri Lanka. Ready for the World.**

Suggested supporting text:

"Discover authentic Sri Lankan condiments, sambols, pickles and spice
blends for retail, wholesale and international distribution."

Primary calls to action: - Explore Our Collections - Request Export
Catalogue

Keep the page premium, clean, easy to scan, and focused on products and
buyer actions. Avoid excessive gradients, decorative elements, empty
space, or a generic corporate dashboard look.

## 4. Collections

Use the real product taxonomy and data where possible. Suggested
groupings, subject to the actual catalogue, are:

-   Chilli Pastes & Condiments
-   Sambols & Badun
-   Pickles & Thokku
-   Ready-to-Eat Curries
-   Spice Blends & Masalas

Each collection card may display: - Approved collection image -
Collection name - Short, accurate description - Product count, only when
reliably derived from data - View Collection action

Do not invent collections, product counts, capabilities, or claims.
Collection links must lead to the correct products and work on mobile.

## 5. Product Catalogue and Buyer Selection

Implement a responsive, searchable catalogue using existing product
records.

Required features: - Search by product name, SKU, and supported
keywords. - Filter by collection/category. - Clear filters. - Select or
deselect individual products. - Select all currently filtered
products. - Display the selected-product count. - Remove individual
products from the selected list. - Start an enquiry with selected
products prepopulated. - Generate a product shortlist/catalogue
containing exactly the selected products.

Product cards should display available verified information such as: -
Official product image - Product name and SKU - Collection - Short
description - Pack sizes and packaging formats - Export specifications,
only when verified

Provide clear loading, empty, error, and no-results states. Do not
display fabricated prices, MOQs, shelf life, certifications, technical
specifications, or lead times.

## 6. Critical Product Image Requirements

Product images must be prominent and complete. Aim for the product
itself to occupy approximately **75--90% of the image area**, when the
source image permits.

-   Show the entire jar, pouch, bottle, or other package.
-   Preserve the label, original colours, proportions, and packaging.
-   Use `object-fit: contain` for product packshots; do not crop
    packages using `object-fit: cover`.
-   Use a consistent image area and alignment across cards.
-   Reduce excess whitespace around the source image where safe, without
    cutting off the product or label.
-   Do not enlarge low-resolution images until visibly pixelated.
-   Use approved ORISTOR product images from the existing project.

### 6.1 Reuse the Existing Media Library --- Important

**Do not require staff to upload another copy of an image that is
already used on an existing product page.** Storage is limited, and
repeated uploads create unnecessary duplicates.

Inspect the current product image/media storage implementation and
provide an **image picker/media-library selector** in the relevant Admin
Console fields.

The selector should allow authorized staff to: 1. Browse or search
images already uploaded and used in product pages. 2. Preview the image
at a useful size. 3. Filter by filename, product, or other metadata
where available. 4. Select an existing image for an export collection,
export listing, hero section, or catalogue setting. 5. Reuse the
existing media ID/reference or URL instead of uploading a duplicate
file. 6. See where a media item is already used, where the existing
architecture supports usage tracking. 7. Upload a new image only when
the required asset does not already exist.

Prefer a shared Media Library with a single stored asset and reusable
references. Do not copy the same image bytes into a new location for
every use.

If product images are currently stored directly on product records or in
an existing media service, extend the current system in the least
disruptive way. Do not build a second media system or migrate all images
without a clear need and an approved migration plan.

Where a new upload is genuinely needed: - Use the existing storage
provider and upload flow. - Accept reasonably sized images; do not
require unnecessarily large 2600×1600 uploads. - Validate file type and
size. - Optimise responsive delivery and generate suitable
derivatives/thumbnails where supported. - Preserve the original image
where required by the current architecture. - Avoid duplicate uploads
through existing asset matching or deduplication capabilities where
feasible. - Follow existing permissions and audit conventions. - Do not
delete a media asset that is still referenced by a product, collection,
page, or catalogue.

The public product card should use the selected existing image
reference. Do not hardcode image paths in page components when the
project already uses database-backed product media.

## 7. Export Catalogue / PDF

Implement a real product-list generation workflow.

A buyer should be able to select products and generate a
printable/downloadable catalogue or shortlist. Use an existing
compatible PDF library if present. If using browser printing, provide a
dedicated print layout and clearly guide the user to Save as PDF.

The document should include, where available and approved: - ORISTOR
branding and approved contact details from existing settings - Document
title and generation date - Selected product images - Product names and
SKUs - Short descriptions - Pack sizes and packaging formats - Verified
specifications - Clear export enquiry call to action

Handle long product names, multiple products, page breaks, and missing
optional data. Include exactly the selected products. Never include
internal costs, margins, confidential notes, unpublished content, or
unverified information.

If public buyer-generated catalogues and staff-generated documents have
different information permissions, enforce those differences
server-side.

## 8. Buyer Information and Enquiry Form

Include a concise section explaining the buyer journey: 1. Explore
collections. 2. Select products of interest. 3. Submit an enquiry. 4.
Discuss quantities, packaging, destination-market requirements, and
commercial terms. 5. Confirm specifications and agree on the supply
arrangement.

Do not promise services or capabilities that have not been confirmed by
ORISTOR.

Suggested enquiry fields: - Full name - Company name - Business email -
Country/market - Buyer type - Selected products/collections - Estimated
quantity or purchasing requirements, if relevant -
Packaging/private-label requirements, if supported - Message

Use existing form components, APIs, server actions, validation, and
email integration wherever possible. Selected products must be passed
into the enquiry form.

Validate on the server, protect against spam using established project
conventions, and show success only when the backend confirms acceptance.
If email/backend support is missing, document the dependency and
implement only the safe parts that the current architecture supports. Do
not fake a successful submission or expose credentials in client code.

## 9. Admin Console Integration

Extend the **existing Admin Console**. Do not create a separate admin
application if current administration capabilities can be reused.

Inspect existing admin navigation, authentication, RBAC, CMS, product
management, Media Library, database models, APIs, audit logs, and
notification services first.

Add an appropriately permission-protected navigation entry, such as
**Export & Wholesale**, with relevant sub-sections. Reuse existing
navigation conventions and avoid duplicate functionality.

### 9.1 Dashboard

Show real data where available: - Number of export-enabled products -
Published and draft export listings - Number of export collections - New
and outstanding buyer enquiries - Enquiries by status - Recent enquiries
and catalogue changes

Do not display fabricated statistics.

### 9.2 Catalogue Product Management

Allow authorized staff to: - Search/filter existing products. - Enable
or disable export visibility without deleting the retail product. - Edit
export-specific descriptions where appropriate. - Assign products to
export collections. - Set featured status and display order. - Preview
the public product card. - Review missing or unverified fields. - Select
the official existing product image through the Media Library/image
picker.

Reuse product IDs, SKUs, images, and relationships. Do not create
duplicate product records for the export catalogue.

### 9.3 Collection Management

Allow authorized staff to manage: - Collection name and unique slug -
Description - Collection image selected from the existing Media
Library - Product membership - Display order - Featured status -
Publication status - Public preview

Validate slugs and handle changed or unpublished collections safely
according to existing routing conventions.

### 9.4 Export Specifications

Provide fields only where appropriate to the existing model and business
needs, such as: - SKU/product code - Net weight and pack size -
Packaging type - Units per carton - Carton dimensions and gross weight -
MOQ - Shelf life and storage conditions - Ingredients and allergen
information - Approved technical documents - Verified destination-market
documentation notes

Use the existing product data as the source of truth wherever possible.
Avoid duplicated fields that can become inconsistent.

Clearly distinguish confirmed, pending verification, and unavailable
information. Unverified information must not appear in public pages or
PDFs.

### 9.5 Publishing Workflow

Reuse the existing CMS workflow if available. Otherwise, implement a
simple workflow appropriate to the project, such as: - Draft - Pending
Review - Published - Archived

Provide preview, validation, publish/unpublish controls, and clear
status indicators. Only published, export-enabled products and
collections may be exposed publicly.

Do not build a complex approval system if existing CMS functionality
already covers this.

### 9.6 Catalogue Settings

Where appropriate, allow authorized staff to configure: - Catalogue
title and introduction - Approved logo/brand assets selected from the
Media Library - Approved company contact details - Product and
collection ordering - Fields shown in the buyer PDF - Whether approved
export pricing is displayed, if such pricing exists and is authorized
for publication

Generated PDFs must contain only approved public information. Do not
expose internal costs, margins, private notes, unpublished products, or
confidential specifications.

### 9.7 Buyer Enquiry Management

Provide a protected admin interface to: - Search by buyer, company,
email, enquiry reference - Filter by status, country, and date - Open
complete enquiry details - Review selected products and buyer
requirements - Add internal follow-up notes - Assign enquiries to staff
if supported - Change enquiry status - Set follow-up dates - Export
enquiry data only for authorized users

Suggested statuses: - New - Under Review - Awaiting Buyer Information -
Quotation in Progress - Quotation Sent - Negotiation - Converted -
Closed --- Not Proceeding

Preserve the original buyer submission. Record significant status
changes and actions in the existing audit log where supported. Enquiries
must never be accessible to unauthorized users or other buyers.

### 9.8 Notifications

Reuse existing email/notification services. Where supported, notify the
appropriate staff about new enquiries, assignment changes, status
changes, and overdue follow-ups.

Do not hardcode credentials or claim delivery unless the system confirms
acceptance. If notification infrastructure is missing, document what
configuration is needed.

## 10. Security, Data Integrity, and Permissions

-   Reuse the existing authentication and role-based access control
    system.
-   Apply least-privilege permissions for viewing, editing, publishing,
    managing enquiries, exporting data, and managing catalogue settings.
-   Enforce authorization in server-side APIs/actions, not only in the
    UI.
-   Validate all inputs on the server.
-   Keep unpublished content and unverified information out of public
    endpoints.
-   Preserve existing product, order, and customer data.
-   Avoid destructive migrations and duplicate sources of truth.
-   Follow current backup, migration, audit, and security practices.
-   Never expose secrets or unnecessary personal data in logs.
-   Do not delete media that is still referenced elsewhere.
-   Do not modify production databases or deploy to production without
    explicit approval.

## 11. Mobile, Accessibility, and Performance

Ensure desktop, tablet, and mobile support.

-   Responsive product grids and collection layouts
-   Prominent, uncropped product imagery
-   Usable search, filters, and selection controls on touch screens
-   Clear form validation and feedback
-   Accessible labels, alternative text, keyboard navigation, focus
    states, and contrast
-   Optimised image delivery and reasonable page performance
-   Pagination for large admin lists
-   Clear loading, empty, success, and error states

Follow existing project conventions and avoid unnecessary dependencies.

## 12. Acceptance Criteria

The feature is complete only when:

1.  The public page matches the current ORISTOR website's design
    language.
2.  Collections, search, filters, product selection, and
    selected-product counts work.
3.  Product images are prominent, complete, and not cropped.
4.  Admin users can reuse existing product-page images through an image
    picker/Media Library rather than uploading duplicates.
5.  Existing images can be reused across products, collections, hero
    content, and PDFs through references to the same stored asset.
6.  New uploads are optional when no suitable existing asset is
    available and follow the existing storage workflow.
7.  Published catalogue changes flow through to the public page without
    code edits.
8.  PDF generation contains the correct selected products and approved
    information.
9.  Buyer enquiries are submitted, stored, and manageable through the
    Admin Console.
10. Unpublished and unverified information remains private.
11. Server-side authorization protects all administrative operations.
12. Relevant validation, audit logging, mobile layouts, and error states
    work.
13. Existing retail catalogue, checkout, orders, and other admin
    functions remain unaffected.
14. Relevant lint, type-check, unit, and end-to-end tests pass, or any
    blocked tests are clearly reported.
15. No fake data, fake success states, or unsupported export claims are
    introduced.

## 13. Implementation and Delivery Workflow

Work incrementally: 1. Inspect the architecture and existing Markdown
specifications. 2. Identify reusable components and report the feature
gaps. 3. Implement the public page. 4. Implement product selection and
catalogue/PDF generation. 5. Implement the enquiry workflow. 6. Extend
the existing Admin Console and reuse the Media Library. 7. Add only
necessary database/API changes. 8. Test security, permissions,
responsive design, and regression risks. 9. Compare the result with the
staging website and prototype. 10. Provide a delivery report.

Before committing, pushing, merging, or deploying, report the changes
and test results. Follow the project's established Git workflow. Keep
all work in the approved development/staging environment until explicit
production approval.

The delivery report must list files changed, features implemented,
reused admin/media functionality, migrations, permissions, API/email
dependencies, tests and results, remaining business decisions, and known
limitations.

**Do not stop at a static mock-up.** Implement working functionality
where the current architecture supports it, and clearly distinguish
implemented features from dependencies that still require configuration
or business approval.
