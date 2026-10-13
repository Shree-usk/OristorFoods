# PROJECT CINNAMON --- Product Variants, Bundles & Custom Export Packaging

**Reference:**
https://www.thespicehouse.com/products/back-of-the-yards-garlic-pepper-butchers-rub\
**Target:** ORISTOR Foods e-commerce website and Admin Console\
**Environment:** Implement and test on `staging.oristor.com` only.\
**Priority:** Complete, admin-controlled commerce functionality without
hard-coding individual product rules.

## 1. First inspect the existing project

Before coding, inspect the current Prisma schema, product catalogue, SKU
and inventory logic, pricing, cart, checkout, payment providers, admin
product editor, and existing tests.

Read the relevant architecture decisions and existing stories. Reuse the
current architecture and components wherever possible.

Do not create duplicate product, variant, bundle, inventory, or payment
models if equivalent structures already exist. Identify what is already
implemented and report any genuine architectural gap briefly before
making changes.

Use the reference website for functional inspiration only. Do not copy
its source code, branding, or exact design.

## 2. Product variants --- selectable sizes and formats

ORISTOR products may be offered in multiple sizes, such as 100 g, 200 g
and 350 g.

Implement a proper parent-product and sellable-variant model where
required.

Each variant must support: - Unique SKU and optional barcode. - Variant
name and net weight. - Selling price and optional promotional price. -
Inventory availability and stock status. - Variant-specific images where
needed. - Active/inactive status. - Optional dimensions and shipping
weight. - Variant-specific availability and fulfilment restrictions when
configured.

### Customer experience

On a product page: - Display the available sizes clearly as selectable
options. - Show the corresponding price and availability for each
size. - Update the displayed product information when a variant is
selected. - Allow customers to add multiple sizes of the same product to
the cart. - Support combinations such as 2 × 100 g, 1 × 200 g and 3 ×
350 g in the same cart. - Show the selected size, quantity and price
correctly in the cart and checkout. - Prevent unavailable or inactive
variants from being ordered. - Ensure inventory and pricing are
validated on the server, not only in the browser.

Do not treat package sizes as separate unrelated products if they belong
to the same product family, unless the existing catalogue architecture
requires a different approach.

## 3. Product bundles and multi-product purchasing

Implement configurable product bundles inspired by the reference page's
bundle-selection and savings features.

Support these bundle types where appropriate: 1. **Fixed bundle:** The
administrator selects the products and quantities. 2. **Selectable
bundle:** The customer selects from administrator-approved products or
variants. 3. **Mix-and-match bundle:** Customers can combine eligible
products and sizes within configured limits. 4. **Promotional bundle:**
A configured bundle price or discount is applied. 5. **Frequently bought
together:** An optional related-product merchandising feature, distinct
from a formal bundle.

### Admin bundle configuration

Administrators must be able to: - Create and edit bundle names,
descriptions and images. - Select eligible products and specific
variants. - Configure minimum and maximum quantities. - Set fixed
pricing, percentage discounts or fixed-amount discounts. - Set start and
end dates. - Activate, deactivate or schedule bundles. - Configure
bundle-level stock or derive availability from component inventory. -
Preview the bundle as a customer would see it.

Clearly show the original combined price, bundle price and savings when
a discount is configured.

### Customer experience

-   Display eligible bundles on relevant product pages.
-   Let customers choose allowed variants and quantities.
-   Update the price dynamically and accurately.
-   Add the bundle to the cart with its component products and selected
    variants preserved.
-   Show bundle contents clearly in cart, checkout, order history and
    admin order details.
-   Validate eligibility, price, discounts and inventory on the server.

Do not apply bundle discounts twice or allow customers to bypass bundle
restrictions by modifying client-side values.

## 4. Special packaging for customers carrying products abroad

Add an optional, administrator-controlled **Custom Travel / Export
Packaging** option to eligible products.

This is for customers who want reduced bulk and weight when carrying
ORISTOR products abroad.

Support configurable packaging options such as: - Standard retail
packaging. - Foil pouch packaging. - Vacuum packaging, only for products
and processes where technically suitable. - Other packaging formats
created by the administrator.

Do not assume every product can safely use every packaging method.
Eligibility must be configurable per product and variant.

### Packaging configuration in the Admin Console

Administrators must be able to configure: - Eligible products and
variants. - Available packaging methods. - Additional packaging
charges. - Minimum order quantities, if required. - Whether the option
is available for local orders, export/travel orders, or both. - Whether
the order requires manual review or production confirmation. -
Preparation lead time. - Order cut-off dates or restricted ordering
periods. - Customer instructions and warnings. - Shelf-life information
applicable to each approved packaging method. - Whether the option is
active, temporarily unavailable, or discontinued.

Store the packaging selection and agreed price as an order-line snapshot
so that future configuration changes do not alter existing orders.

### Customer-facing selection

On eligible product pages, allow the customer to choose standard or
available custom packaging.

Explain that custom packaging is prepared to order and may have a
different preparation lead time and shelf life.

Show all applicable additional charges before checkout. Require the
customer to acknowledge relevant handling, shelf-life and availability
information before placing the order.

Do not promise longer shelf life or weight savings without verified
product-specific information.

## 5. Shelf life, production lead time and availability

This is a critical requirement for custom-packaged products.

Provide administrator-controlled settings for: - Standard shelf life for
each applicable product or variant. - Shelf life associated with each
approved packaging method, where validated. - Manufacturing or
preparation lead time. - Earliest estimated dispatch date. - Product and
packaging availability windows. - Order cut-off times or dates. -
Minimum order quantities where necessary. - Temporary unavailability and
manual approval requirements. - Customer-facing storage and handling
instructions.

Use the product's approved data and configured rules. Do not invent
shelf-life values.

Display clear availability and preparation information before checkout.
Revalidate restrictions when the order is submitted.

Where the requested packaging requires manual confirmation, place the
order into an appropriate pending-confirmation state rather than
promising immediate fulfilment.

Preserve the distinction between: - Product shelf life. - Order
preparation lead time. - Estimated dispatch or delivery date.

## 6. Mandatory payment restriction for custom packaging

For orders containing custom travel/export packaging, the customer must
be restricted to the administrator-approved payment methods:

-   Card payment.
-   Bank transfer.

No cash on delivery, cash payment, or other payment methods should be
offered for these orders.

This restriction must be enforced on the server and in checkout, not
merely by hiding buttons in the user interface.

Rules: - Standard orders should retain their existing eligible payment
options. - Orders requiring custom packaging must offer only card and
bank transfer. - If a cart mixes standard products with custom-packaged
products, apply the restricted payment set to the entire order. - If a
selected payment method becomes invalid after cart changes, require the
customer to select an allowed method again. - Bank-transfer orders must
follow the existing payment-verification workflow. - Card orders must
use the project's existing payment integration and status handling. - Do
not mark an order paid solely because a customer selected card or bank
transfer. - Do not introduce a real payment provider or production
credentials as part of this feature. - If a currently supported card
integration is not configured, report the gap and use the project's
established sandbox/mock approach only for staging tests.

Store the packaging choice and payment restrictions in a reliable,
auditable order record.

## 7. Admin Console requirements

All these features must be manageable through the Admin Console without
code changes.

Organise the controls under the existing product and commerce management
sections where possible.

Administrators should be able to: - Manage product variants and
pricing. - Manage bundle definitions and eligible variants. - Configure
custom packaging eligibility, pricing and availability. - Manage
shelf-life and preparation rules. - Configure allowed payment methods
for custom-packaging orders. - Preview the customer-facing product
page. - Review custom-packaging selections on individual orders. -
Identify pending confirmation, production and payment statuses.

Apply the project's existing role-based access controls, validation
rules and audit conventions.

## 8. Data integrity and order management

Ensure that: - Every purchased variant has a stable SKU or variant
identifier. - Cart and order items retain the selected variant and
packaging method. - Historical orders preserve the prices, discounts,
packaging charges and terms accepted at purchase time. - Inventory
cannot be oversold through concurrent checkout attempts. - Bundle
inventory and discounts remain consistent. - Server-side validation
prevents manipulated prices, quantities, packaging selections or payment
methods. - Order confirmation emails and admin order details show the
relevant selections where those features already exist.

Do not delete or corrupt existing products, orders, customer data,
inventory or reviews.

## 9. Testing and acceptance criteria

Test at least the following scenarios:

1.  A customer purchases one 100 g variant.
2.  A customer purchases several sizes of the same product in one order.
3.  A bundle with selectable products and sizes calculates its price
    correctly.
4.  Bundle discounts cannot be applied twice or manipulated by the
    browser.
5.  An unavailable variant cannot be purchased.
6.  An eligible product allows custom foil or vacuum packaging.
7.  An ineligible product cannot select unsupported packaging.
8.  Custom packaging displays its additional charge, lead time and
    configured shelf-life information.
9.  A custom-packaging order offers only card and bank transfer.
10. A mixed cart containing a custom-packaged item also restricts
    payment methods.
11. Server-side checkout rejects a disallowed payment method.
12. Changes to product or packaging settings do not alter existing order
    snapshots.
13. The Admin Console can configure and preview the features without
    code changes.
14. Existing standard product purchases and payment flows continue to
    work.

Run the relevant tests, type checks, lint and production build. Test on
staging only.

## 10. Implementation approach and deliverables

Implement the work in focused, logically grouped changes. Reuse existing
functionality and avoid unnecessary schema duplication.

Before changing the database schema, determine the required migrations
and preserve existing data. Never use `prisma db push` or
`prisma migrate reset` on the staging or production database.

At completion, provide: - A concise summary of what was implemented. -
The admin navigation path for each new setting. - The customer
workflow. - Database migration details, if any. - Test results and known
limitations. - Any required administrator configuration before enabling
the features. - A list of changed files and the Git branch/PR status.

Do not change `oristor.com` production. Deploy to `staging.oristor.com`
only through the existing GitHub and VPS deployment workflow, and do not
claim a feature is complete until it has been tested end-to-end.
