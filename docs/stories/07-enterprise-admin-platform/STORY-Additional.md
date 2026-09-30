PROJECT CINNAMON — ADMIN CMS ENHANCEMENT INSTRUCTION

IMPORTANT:
Do NOT modify, overwrite, restructure, or invalidate any existing approved Project Cinnamon documents, PRES, architecture, stories, acceptance criteria, or previously implemented features.

Treat the following as an ADDITIVE enhancement to the existing specification and implementation.

==================================================
1. HERO BANNER / HOMEPAGE MEDIA MANAGEMENT
==================================================

Extend the existing Admin Console/CMS so an authorized administrator can manage homepage Hero Banner content without developer intervention.

Create/extend:

Admin Console
→ Content
→ Homepage
→ Hero Banners

Administrators must be able to:

- Upload new hero media
- Select existing media from the Media Library
- Replace hero images/videos
- Archive/delete media where permitted
- Create multiple hero banners
- Reorder banners
- Enable/disable banners
- Save as Draft
- Preview
- Publish
- Unpublish
- Schedule publication
- Set start date/time
- Set end date/time
- Duplicate an existing banner
- Restore a previous version where versioning is supported

Each Hero Banner should support:

- Desktop image/media
- Tablet image/media where required
- Mobile-specific image/media
- Heading
- Subheading
- Supporting text
- CTA label
- CTA destination
- Optional secondary CTA
- Optional video
- Alt text/accessibility metadata
- Overlay configuration
- Content alignment
- Display priority/order
- Active/inactive status
- Publication status
- Start/end scheduling

The website frontend must consume this content dynamically.

Do NOT hard-code Hero Banner content into frontend components.

==================================================
2. MEDIA LIBRARY
==================================================

Establish or extend a centralized:

Admin Console
→ Media Library

The Media Library must support:

- Images
- Videos
- Documents where applicable
- Brand assets

Administrators should be able to:

- Upload
- Preview
- Search
- Filter
- Replace where appropriate
- Archive
- Delete where permitted
- View metadata
- Reuse existing media
- Associate media with CMS content

Do not create unnecessary duplicate copies of the same asset.

The Media Library must become the reusable source for CMS media.

Implement secure upload validation including:

- File type validation
- File size validation
- Safe file naming
- Malware/security considerations
- Image dimension validation where required
- Authorization
- Audit logging

Use the existing Project Cinnamon storage/cloud architecture and conventions.

==================================================
3. PROMOTIONAL POP-UP MANAGER
==================================================

ADD a dedicated Admin Console module:

Admin Console
→ Marketing
→ Promotional Pop-ups

This must be implemented as an additive feature without disrupting existing CMS functionality.

Administrators must be able to create and manage promotional pop-ups.

Content fields should support:

- Popup title
- Description
- Image
- Mobile image
- Video where appropriate
- CTA label
- CTA URL
- Optional coupon code
- Optional secondary CTA
- Display styling consistent with the existing design system

==================================================
4. POP-UP DISPLAY TARGETING
==================================================

Allow administrators to define where the popup appears:

- Homepage
- All pages
- Selected pages
- Product pages
- Recipe pages
- Blog pages
- Other supported CMS pages

Where the existing architecture already provides a targeting/segmentation system, reuse it rather than creating a competing system.

==================================================
5. POP-UP AUDIENCE TARGETING
==================================================

Support appropriate audience targeting such as:

- All visitors
- New visitors
- Returning visitors
- Authenticated customers
- Specific customer segments
- Loyalty/reward members
- Referral members

Use the existing customer/segmentation architecture wherever available.

Do not duplicate customer segmentation logic.

==================================================
6. POP-UP TRIGGERS
==================================================

Support configurable triggers where technically and UX appropriate:

- Immediately
- After a configurable time delay
- After configurable page-scroll percentage
- Exit intent where supported
- After configurable page views
- After add-to-cart
- Before checkout where appropriate

Triggers must not create a disruptive or inaccessible user experience.

Respect existing consent, privacy, accessibility and device rules.

==================================================
7. POP-UP FREQUENCY CONTROL
==================================================

Administrators should be able to configure frequency:

- Once per session
- Once per day
- Once per week
- Once per customer
- Until dismissed

Persist the required state using the appropriate existing frontend/customer architecture.

Do not rely on client-side state alone for rules that require server-side enforcement.

==================================================
8. POP-UP SCHEDULING
==================================================

Support:

- Start date/time
- End date/time
- Draft
- Scheduled
- Published
- Paused
- Unpublished
- Archived

The system must automatically determine whether a popup is eligible for display based on its schedule and status.

Use the application's established timezone/date handling conventions.

==================================================
9. POP-UP WORKFLOW
==================================================

Recommended lifecycle:

Draft
→ Scheduled
→ Published
→ Paused
→ Unpublished/Archived

Ensure unauthorized users cannot publish content unless their RBAC permissions allow it.

Maintain audit information for important content mutations.

==================================================
10. PREVIEW
==================================================

Provide Admin Preview before publication.

Preview should support:

- Desktop
- Tablet
- Mobile

Administrators must be able to verify the visual presentation before publishing.

Preview must not accidentally publish draft content.

==================================================
11. ANALYTICS READINESS
==================================================

Design both Hero Banners and Promotional Pop-ups so they can support analytics.

Capture appropriate events such as:

Hero impression
Hero CTA click
Popup impression
Popup CTA click
Popup dismissal

Where analytics infrastructure already exists, integrate with it.

Do not introduce a second analytics architecture.

==================================================
12. RBAC
==================================================

Use the existing Project Cinnamon RBAC system.

Recommended permissions:

CONTENT_HERO_VIEW
CONTENT_HERO_CREATE
CONTENT_HERO_EDIT
CONTENT_HERO_PUBLISH
CONTENT_HERO_ARCHIVE

MEDIA_VIEW
MEDIA_UPLOAD
MEDIA_EDIT
MEDIA_ARCHIVE
MEDIA_DELETE

PROMOTION_VIEW
PROMOTION_CREATE
PROMOTION_EDIT
PROMOTION_PUBLISH
PROMOTION_PAUSE
PROMOTION_ARCHIVE

Do not bypass existing authorization middleware.

==================================================
13. AUDIT LOGGING
==================================================

Important CMS changes must be auditable.

Record:

- Who performed the action
- What was changed
- Previous value where appropriate
- New value where appropriate
- Date/time
- Action type

Use the existing Project Cinnamon audit architecture.

==================================================
14. DATABASE / API / FRONTEND
==================================================

Before implementation:

1. Inspect the existing CMS models.
2. Inspect existing media/storage models.
3. Inspect existing homepage/banner implementation.
4. Inspect existing RBAC.
5. Inspect existing audit logging.
6. Inspect existing analytics.
7. Inspect existing customer segmentation.
8. Identify reusable patterns.

Then extend the existing architecture.

Do NOT create duplicate systems where an existing Project Cinnamon service/model already provides the required capability.

==================================================
15. NON-REGRESSION REQUIREMENT
==================================================

This is an ADDITIVE enhancement.

Do NOT:

- Rewrite existing CMS architecture unnecessarily.
- Remove existing functionality.
- Rename existing approved models without necessity.
- Change existing business rules.
- Change existing approved UX without reason.
- Modify previously approved stories unnecessarily.
- Replace existing architecture with a competing pattern.

Preserve backward compatibility wherever applicable.

==================================================
16. FORMAL SPECIFICATION UPDATE
==================================================

Create the necessary technical specification/addendum for these enhancements.

Clearly identify it as:

PROJECT CINNAMON
ADMIN CMS & PROMOTIONAL MEDIA MANAGEMENT
ADDITIVE ENHANCEMENT

Do not alter the original approved documents.

Cross-reference the existing specifications instead.

==================================================
17. ACCEPTANCE CRITERIA
==================================================

The enhancement is complete only when:

✓ Admin can upload hero media.
✓ Admin can replace hero media.
✓ Admin can manage multiple hero banners.
✓ Admin can reorder banners.
✓ Admin can schedule banners.
✓ Admin can publish/unpublish banners.
✓ Admin can use mobile-specific media.
✓ Admin can manage media through a centralized Media Library.
✓ Admin can create promotional pop-ups.
✓ Admin can configure popup content.
✓ Admin can select popup display locations.
✓ Admin can configure audience targeting.
✓ Admin can configure triggers.
✓ Admin can configure frequency.
✓ Admin can schedule promotions.
✓ Admin can preview before publishing.
✓ RBAC is enforced.
✓ Audit logging is implemented.
✓ Analytics events are supported.
✓ Responsive behaviour is implemented.
✓ Accessibility requirements are respected.
✓ Existing Project Cinnamon functionality remains intact.
✓ Existing architecture and conventions are reused wherever appropriate.

Before coding, inspect the current implementation and produce the smallest additive change required to satisfy these requirements.