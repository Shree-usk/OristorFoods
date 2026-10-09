-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('Active', 'DeactivationRequested', 'Deactivated', 'Suspended');

-- CreateEnum
CREATE TYPE "SeoEntityType" AS ENUM ('Product', 'Recipe', 'BlogPost');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PercentageOff', 'FixedAmountOff', 'FreeShipping');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('AllProducts', 'Category', 'Product');

-- CreateEnum
CREATE TYPE "RewardTransactionType" AS ENUM ('Earned', 'Redeemed', 'Reversed', 'Expired', 'ReferralBonus', 'ReferralBonusReversed', 'ReferralWelcomeBonus');

-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('Home', 'Work', 'Other');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('Shipping', 'Billing', 'Both');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('Requested', 'Approved', 'Rejected', 'Completed');

-- CreateEnum
CREATE TYPE "ReturnReasonCode" AS ENUM ('Damaged', 'WrongItem', 'NotAsDescribed', 'ChangedMind', 'Other');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('OrderIssue', 'Product', 'Delivery', 'Billing', 'Other');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

-- CreateEnum
CREATE TYPE "SupportTicketSource" AS ENUM ('Customer', 'AiAssistant');

-- CreateEnum
CREATE TYPE "OrderIntegrationEventStatus" AS ENUM ('Pending', 'Processed', 'Failed');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('Queued', 'Processing', 'Success', 'Failed');

-- CreateEnum
CREATE TYPE "ReferralAttributionStatus" AS ENUM ('Registered', 'Qualified', 'Excluded');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('Email', 'SMS', 'WhatsApp');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('Sent', 'Failed', 'SkippedNoConsent');

-- CreateEnum
CREATE TYPE "CampaignAudienceTarget" AS ENUM ('AllCustomers', 'CustomerGroupTarget', 'LoyaltyMembers', 'ReferralMembers', 'SavedSegment');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('Draft', 'Scheduled', 'Sent');

-- CreateEnum
CREATE TYPE "AdminModule" AS ENUM ('Products', 'MediaLibrary', 'HomepageBuilder', 'Recipes', 'Blog', 'Reviews', 'QA', 'Orders', 'Customers', 'RewardsReferrals', 'Marketing', 'SEO', 'Navigation', 'CMSWorkflow', 'SystemSettings', 'DeliveryZones', 'ERPIntegration', 'UsersRolesAudit', 'ExportPortal', 'CRMAnalytics', 'ContactEnquiries', 'StoryPages');

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('View', 'Edit', 'Delete', 'Approve', 'Export', 'Audit');

-- CreateEnum
CREATE TYPE "AdminUserStatus" AS ENUM ('Active', 'Locked', 'Deactivated', 'Invited');

-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('Pending', 'Approved', 'Reversed');

-- CreateEnum
CREATE TYPE "PopupStatus" AS ENUM ('Draft', 'Scheduled', 'Published', 'Paused', 'Unpublished', 'Archived');

-- CreateEnum
CREATE TYPE "PopupPageTarget" AS ENUM ('AllPages', 'Homepage', 'Products', 'Recipes', 'Blog');

-- CreateEnum
CREATE TYPE "PopupAudienceTarget" AS ENUM ('AllVisitors', 'NewVisitors', 'ReturningVisitors', 'Authenticated', 'CustomerGroupTarget', 'LoyaltyMembers', 'ReferralMembers');

-- CreateEnum
CREATE TYPE "PopupTriggerType" AS ENUM ('Immediate', 'TimeDelay', 'ScrollDepth', 'ExitIntent', 'PageViews', 'AddToCart', 'BeforeCheckout');

-- CreateEnum
CREATE TYPE "PopupFrequencyCap" AS ENUM ('OncePerSession', 'OncePerDay', 'OncePerWeek', 'OncePerCustomer', 'UntilDismissed');

-- CreateEnum
CREATE TYPE "PopupInteractionType" AS ENUM ('Impression', 'Click', 'Dismissal');

-- CreateEnum
CREATE TYPE "SeasonalCampaignStatus" AS ENUM ('Draft', 'Scheduled', 'Active', 'Ended', 'Archived');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('Image', 'Video', 'Document');

-- CreateEnum
CREATE TYPE "HomepageLayoutStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "HomepageSectionType" AS ENUM ('HeroBanner', 'FeaturedCategories', 'WhyChooseOristor', 'BestSellingProducts', 'FeaturedRecipes', 'ProductCollections', 'FoodAcademy', 'CustomerReviews', 'ExportSolutions', 'RewardsClub', 'InstagramGallery');

-- CreateEnum
CREATE TYPE "ContentAlignment" AS ENUM ('Left', 'Center', 'Right');

-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "MenuLocation" AS ENUM ('Header', 'Footer', 'Mobile');

-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "MenuLinkType" AS ENUM ('None', 'Internal', 'External');

-- CreateEnum
CREATE TYPE "MenuItemVisibility" AS ENUM ('Always', 'Authenticated', 'CustomerGroupTarget');

-- CreateEnum
CREATE TYPE "MenuContentBlockType" AS ENUM ('Link', 'PromoTile');

-- CreateEnum
CREATE TYPE "StoryPage" AS ENUM ('AboutUs');

-- CreateEnum
CREATE TYPE "StoryBlockType" AS ENUM ('Hero', 'Chapter', 'IngredientItem', 'ProductCategoryItem', 'ValueItem', 'GlobalJourney', 'Cta');

-- CreateEnum
CREATE TYPE "TaxPricingDisplayMode" AS ENUM ('Inclusive', 'Exclusive');

-- CreateEnum
CREATE TYPE "ExportEnquiryStatus" AS ENUM ('New', 'InDiscussion', 'Quoted', 'Won', 'Lost');

-- CreateEnum
CREATE TYPE "ScheduledReportFrequency" AS ENUM ('Weekly', 'Monthly');

-- CreateEnum
CREATE TYPE "ProductInteractionEventType" AS ENUM ('View', 'AddToCart', 'WishlistAdd');

-- CreateEnum
CREATE TYPE "ProductAssociationType" AS ENUM ('Similar', 'FrequentlyBoughtTogether');

-- CreateEnum
CREATE TYPE "RecommendationPlacement" AS ENUM ('Homepage', 'Pdp', 'Cart');

-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('Impression', 'Click', 'AddToCart');

-- CreateEnum
CREATE TYPE "ContentSourceType" AS ENUM ('Recipe', 'BlogPost', 'FoodAcademyEntry');

-- CreateEnum
CREATE TYPE "RecipeAssistantMessageRole" AS ENUM ('User', 'Assistant');

-- CreateEnum
CREATE TYPE "SupportAssistantMessageRole" AS ENUM ('User', 'Assistant');

-- CreateEnum
CREATE TYPE "ChurnRiskTier" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "BusinessInsightMetricType" AS ENUM ('Trend', 'Anomaly', 'CampaignSuggestion');

-- CreateEnum
CREATE TYPE "ContactEnquiryType" AS ENUM ('General', 'Product', 'CustomerSupport', 'Wholesale', 'Distributor', 'RetailPartnership', 'FoodService', 'Media', 'Careers', 'Other');

-- CreateEnum
CREATE TYPE "ContactEnquiryStatus" AS ENUM ('New', 'InProgress', 'Responded', 'Closed', 'Spam');

-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'Hidden';

-- AlterTable (STORY-034: split Address.isDefault into isDefaultBilling/isDefaultShipping)
ALTER TABLE "Address" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'LK',
ADD COLUMN     "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" "AddressLabel" NOT NULL DEFAULT 'Home',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "type" "AddressType" NOT NULL DEFAULT 'Both';

-- Data migration: backfill isDefaultBilling/isDefaultShipping from the
-- legacy isDefault flag before dropping it. Every pre-existing row's new
-- "type" column defaults to 'Both' (no prior shipping/billing distinction
-- existed), matching STORY-034's own documented invariant for a first
-- address ("first address becomes both defaults") -- so the single legacy
-- default naturally becomes a default of both kinds.
--
-- Defensive dedup: STORY-034's "exactly one default of each kind" rule is
-- enforced only at the application layer (address.service.ts) and did not
-- exist before this story. If legacy data somehow has more than one
-- isDefault=true address for the same user, keep only the most recently
-- updated one as the new default, so the backfill can't hand a user two
-- simultaneous billing/shipping defaults on day one.
WITH ranked_defaults AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "userId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
         ) AS rn
  FROM "Address"
  WHERE "isDefault" = true
)
UPDATE "Address" a
SET "isDefaultBilling" = true,
    "isDefaultShipping" = true
FROM ranked_defaults r
WHERE a.id = r.id AND r.rn = 1;

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "isDefault";

-- AlterTable
ALTER TABLE "BlogComment" ADD COLUMN     "adminReplyBody" TEXT;

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "pointsToRedeem" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "discountLabel" TEXT,
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsRedemptionValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewerComment" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "RecipeReview" ADD COLUMN     "adminReplyBody" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "adminReplyBody" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerGroup" "CustomerGroup" NOT NULL DEFAULT 'Retail',
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "deactivationReason" TEXT,
ADD COLUMN     "deactivationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'Active',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedById" TEXT,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "RecipeQuestion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'Pending',
    "answerText" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoMeta" (
    "id" TEXT NOT NULL,
    "entityType" "SeoEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "ogImageUrl" TEXT,
    "ogImageAlt" TEXT,
    "ogImageWidth" INTEGER,
    "ogImageHeight" INTEGER,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "percentOff" DECIMAL(5,2),
    "amountOff" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "minOrderValue" DECIMAL(10,2),
    "usageLimitGlobal" INTEGER,
    "usageLimitPerCustomer" INTEGER,
    "scope" "CouponScope" NOT NULL DEFAULT 'AllProducts',
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restrictedToUserId" TEXT,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponScopeProduct" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CouponScopeProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "CouponScopeCategory" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CouponScopeCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "orderId" TEXT NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "percentOff" DECIMAL(5,2),
    "amountOff" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "minOrderValue" DECIMAL(10,2),
    "scope" "CouponScope" NOT NULL DEFAULT 'AllProducts',
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionScopeProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionScopeProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "PromotionScopeCategory" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PromotionScopeCategory_pkey" PRIMARY KEY ("promotionId","categoryId")
);

-- CreateTable
CREATE TABLE "RewardAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentTierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RewardTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "expiresEarnedTransactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minLifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteriaType" TEXT NOT NULL,
    "threshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,

    CONSTRAINT "CustomerBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "pointsToCurrencyRate" DECIMAL(10,4),
    "maxRedeemablePointsPerOrder" INTEGER,
    "pointsExpiryDays" INTEGER,
    "orderValuePointsRate" DECIMAL(10,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetCustomerGroup" "CustomerGroup",
    "pointsMultiplier" DECIMAL(4,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'Requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reasonCode" "ReturnReasonCode",
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "restocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "category" "SupportTicketCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'Open',
    "source" "SupportTicketSource" NOT NULL DEFAULT 'Customer',
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderIntegrationEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OrderIntegrationEventStatus" NOT NULL DEFAULT 'Pending',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderIntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'Queued',
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJobAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "result" "SyncJobStatus" NOT NULL,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncJobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" "ReferralAttributionStatus" NOT NULL DEFAULT 'Registered',
    "excludedReason" TEXT,
    "qualifyingOrderId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "referrerBonusPoints" INTEGER,
    "minQualifyingOrderValue" DECIMAL(10,2),
    "attributionWindowDays" INTEGER,
    "referredWelcomeBonusPoints" INTEGER,
    "maxReferralsPerPeriod" INTEGER,
    "referralPeriodDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "rewardUpdatesOptIn" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "provider" TEXT,
    "providerReference" TEXT,
    "error" TEXT,
    "triggeringEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSmsCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "audienceTarget" "CampaignAudienceTarget" NOT NULL,
    "targetCustomerGroup" "CustomerGroup",
    "targetSegmentId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'Draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "AdminModule" NOT NULL,
    "action" "AdminAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" TEXT NOT NULL,
    "status" "AdminUserStatus" NOT NULL DEFAULT 'Active',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "module" "AdminModule",
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudFlag" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "relatedRewardTransactionId" TEXT,
    "relatedReferralAttributionId" TEXT,
    "status" "FraudFlagStatus" NOT NULL DEFAULT 'Pending',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionalPopup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PopupStatus" NOT NULL DEFAULT 'Draft',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "mobileImageUrl" TEXT,
    "mobileImageAlt" TEXT,
    "videoUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "couponCode" TEXT,
    "pageTarget" "PopupPageTarget" NOT NULL DEFAULT 'AllPages',
    "audienceTarget" "PopupAudienceTarget" NOT NULL DEFAULT 'AllVisitors',
    "targetCustomerGroup" "CustomerGroup",
    "triggerType" "PopupTriggerType" NOT NULL DEFAULT 'Immediate',
    "triggerValue" INTEGER,
    "frequencyCap" "PopupFrequencyCap" NOT NULL DEFAULT 'OncePerSession',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "variantGroupId" TEXT,
    "variantWeight" INTEGER NOT NULL DEFAULT 100,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionalPopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopupInteraction" (
    "id" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "PopupInteractionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopupInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonalCampaignStatus" NOT NULL DEFAULT 'Draft',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "popupId" TEXT,
    "couponId" TEXT,
    "emailSmsCampaignId" TEXT,
    "homepageSectionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAssetTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MediaAssetTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "folderId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageLayout" (
    "id" TEXT NOT NULL,
    "status" "HomepageLayoutStatus" NOT NULL DEFAULT 'Draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "type" "HomepageSectionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroBannerSlide" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "supportingText" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "desktopImageUrl" TEXT NOT NULL,
    "desktopImageAlt" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "mobileImageAlt" TEXT,
    "videoUrl" TEXT,
    "overlayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alignment" "ContentAlignment" NOT NULL DEFAULT 'Left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroBannerSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'Draft',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageBlock" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "supportingText" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "desktopImageUrl" TEXT NOT NULL,
    "desktopImageAlt" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "mobileImageAlt" TEXT,
    "videoUrl" TEXT,
    "overlayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alignment" "ContentAlignment" NOT NULL DEFAULT 'Left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "location" "MenuLocation" NOT NULL,
    "status" "MenuStatus" NOT NULL DEFAULT 'Draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "linkType" "MenuLinkType" NOT NULL DEFAULT 'None',
    "internalPath" TEXT,
    "externalUrl" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "visibility" "MenuItemVisibility" NOT NULL DEFAULT 'Always',
    "targetCustomerGroup" "CustomerGroup",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contentBlockType" "MenuContentBlockType" NOT NULL DEFAULT 'Link',
    "promoImageUrl" TEXT,
    "promoImageAlt" TEXT,
    "promoHeading" TEXT,
    "promoCtaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "legalName" TEXT,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "logoAlt" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "businessRegistrationId" TEXT,
    "taxId" TEXT,
    "socialLinks" JSONB,
    "businessHours" TEXT,
    "contactHeroEyebrow" TEXT,
    "contactHeroHeadline" TEXT,
    "contactHeroSubcopy" TEXT,
    "contactLocationHeading" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPageBlock" (
    "id" TEXT NOT NULL,
    "page" "StoryPage" NOT NULL,
    "blockType" "StoryBlockType" NOT NULL,
    "blockKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eyebrow" TEXT,
    "title" TEXT,
    "body" VARCHAR(4000),
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "align" "ContentAlignment",
    "letter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryPageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencySetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "baseCurrency" TEXT NOT NULL DEFAULT 'LKR',
    "supportedCurrencies" TEXT[] DEFAULT ARRAY['LKR']::TEXT[],
    "manualExchangeRates" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocaleSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "supportedLocales" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocaleSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "pricingDisplayMode" "TaxPricingDisplayMode" NOT NULL DEFAULT 'Exclusive',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRateRule" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "category" TEXT,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportEnquiry" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "country" TEXT NOT NULL,
    "productsOfInterest" TEXT NOT NULL,
    "volumeEstimate" TEXT,
    "message" VARCHAR(4000) NOT NULL,
    "status" "ExportEnquiryStatus" NOT NULL DEFAULT 'New',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportEnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportEnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorAccount" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "userId" TEXT NOT NULL,
    "convertedFromEnquiryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filterCriteria" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "recipients" TEXT[],
    "frequency" "ScheduledReportFrequency" NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInteractionEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT NOT NULL,
    "eventType" "ProductInteractionEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInteractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAssociation" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "associationType" "ProductAssociationType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "placement" "RecommendationPlacement" NOT NULL,
    "productId" TEXT NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentEmbedding" (
    "id" TEXT NOT NULL,
    "sourceType" "ContentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "isZeroResult" BOOLEAN NOT NULL,
    "embeddingTokens" INTEGER,
    "customerId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchGlossaryTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "canonicalTerm" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchGlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeAssistantConversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeAssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeAssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "RecipeAssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredPayload" JSONB,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeAssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAssistantConversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupportAssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "SupportAssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredPayload" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerChurnScore" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "riskTier" "ChurnRiskTier" NOT NULL,
    "signalBreakdown" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerChurnScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessInsightSnapshot" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metricType" "BusinessInsightMetricType" NOT NULL,
    "narrativeText" TEXT NOT NULL,
    "sourceQueryRef" JSONB NOT NULL,
    "structuredPayload" JSONB,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessInsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEnquiry" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "companyName" TEXT,
    "country" TEXT,
    "enquiryType" "ContactEnquiryType" NOT NULL,
    "businessType" TEXT,
    "productInterest" TEXT,
    "message" VARCHAR(4000) NOT NULL,
    "status" "ContactEnquiryStatus" NOT NULL DEFAULT 'New',
    "source" TEXT NOT NULL DEFAULT 'contact-page',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MediaAssetToMediaAssetTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MediaAssetToMediaAssetTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "RecipeQuestion_recipeId_status_publishedAt_idx" ON "RecipeQuestion"("recipeId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "RecipeQuestion_recipeId_customerId_status_idx" ON "RecipeQuestion"("recipeId", "customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeoMeta_entityType_entityId_key" ON "SeoMeta"("entityType", "entityId");

-- Data migration: backfill SeoMeta from the legacy inline SEO columns on
-- Product and Recipe. STORY-051a introduced SeoMeta as the shared,
-- polymorphic replacement and schema.prisma dropped the inline columns
-- immediately via db push; this migration is the first time that drop is
-- actually applied to committed migration history, so the data has to be
-- carried forward here. ON CONFLICT DO NOTHING is the "never overwrite a
-- newer SeoMeta value" rule: if this entity's SEO fields were already
-- edited through the new SeoMeta-backed admin panel in any environment
-- where db push already carried both the new table and the old columns
-- side by side, that row already exists and wins -- the legacy value only
-- backfills entities nobody has touched since. Partial legacy records
-- (only one of the four fields set) are preserved as-is; an unset legacy
-- field just stays NULL on the new row rather than being invented.
--
-- ids use gen_random_uuid() (built into Postgres >= 13, no extension
-- needed) rather than Prisma's cuid() format -- cuid() only exists in the
-- Prisma Client/JS runtime, not as a SQL-callable function, so a raw-SQL
-- migration has no access to it. The column is a plain String primary key
-- either way; nothing in the app reads or validates its format.
INSERT INTO "SeoMeta" ("id", "entityType", "entityId", "metaTitle", "metaDescription", "canonicalUrl", "ogImageUrl", "robotsIndex", "robotsFollow", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Product', p."id", p."metaTitle", p."metaDescription", p."canonicalUrl", p."ogImage", true, true, now(), now()
FROM "Product" p
WHERE (p."metaTitle" IS NOT NULL AND btrim(p."metaTitle") <> '')
   OR (p."metaDescription" IS NOT NULL AND btrim(p."metaDescription") <> '')
   OR (p."canonicalUrl" IS NOT NULL AND btrim(p."canonicalUrl") <> '')
   OR (p."ogImage" IS NOT NULL AND btrim(p."ogImage") <> '')
ON CONFLICT ("entityType", "entityId") DO NOTHING;

INSERT INTO "SeoMeta" ("id", "entityType", "entityId", "metaTitle", "metaDescription", "robotsIndex", "robotsFollow", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Recipe', r."id", r."metaTitle", r."metaDescription", true, true, now(), now()
FROM "Recipe" r
WHERE (r."metaTitle" IS NOT NULL AND btrim(r."metaTitle") <> '')
   OR (r."metaDescription" IS NOT NULL AND btrim(r."metaDescription") <> '')
ON CONFLICT ("entityType", "entityId") DO NOTHING;

-- AlterTable: legacy SEO columns are fully migrated into SeoMeta above.
ALTER TABLE "Product" DROP COLUMN "canonicalUrl",
DROP COLUMN "metaDescription",
DROP COLUMN "metaTitle",
DROP COLUMN "ogImage";

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "metaDescription",
DROP COLUMN "metaTitle";

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_sourcePath_key" ON "Redirect"("sourcePath");

-- CreateIndex
CREATE INDEX "Redirect_active_idx" ON "Redirect"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_isActive_idx" ON "Coupon"("code", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_startDate_endDate_idx" ON "Coupon"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CouponScopeProduct_productId_idx" ON "CouponScopeProduct"("productId");

-- CreateIndex
CREATE INDEX "CouponScopeCategory_categoryId_idx" ON "CouponScopeCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_guestEmail_idx" ON "CouponRedemption"("couponId", "guestEmail");

-- CreateIndex
CREATE INDEX "Promotion_isActive_startDate_endDate_idx" ON "Promotion"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "PromotionScopeProduct_productId_idx" ON "PromotionScopeProduct"("productId");

-- CreateIndex
CREATE INDEX "PromotionScopeCategory_categoryId_idx" ON "PromotionScopeCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAccount_userId_key" ON "RewardAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_expiresEarnedTransactionId_key" ON "RewardTransaction"("expiresEarnedTransactionId");

-- CreateIndex
CREATE INDEX "RewardTransaction_userId_createdAt_idx" ON "RewardTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardTransaction_userId_type_idx" ON "RewardTransaction"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_orderId_type_key" ON "RewardTransaction"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTier_name_key" ON "RewardTier"("name");

-- CreateIndex
CREATE INDEX "RewardTier_minLifetimePoints_idx" ON "RewardTier"("minLifetimePoints");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE INDEX "CustomerBadge_userId_idx" ON "CustomerBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBadge_userId_badgeId_key" ON "CustomerBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "RewardCampaign_startDate_endDate_isActive_idx" ON "RewardCampaign"("startDate", "endDate", "isActive");

-- CreateIndex
CREATE INDEX "RefundRecord_orderId_idx" ON "RefundRecord"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_status_idx" ON "SupportTicket"("userId", "status");

-- CreateIndex
CREATE INDEX "OrderIntegrationEvent_orderId_idx" ON "OrderIntegrationEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderIntegrationEvent_status_createdAt_idx" ON "OrderIntegrationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_jobType_idx" ON "SyncJob"("jobType");

-- CreateIndex
CREATE INDEX "SyncJobAttempt_jobId_idx" ON "SyncJobAttempt"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerUserId_idx" ON "ReferralAttribution"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_status_idx" ON "ReferralAttribution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_templateKey_channel_key" ON "NotificationTemplate"("templateKey", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_triggeringEventId_templateKey_channel_recip_key" ON "NotificationLog"("triggeringEventId", "templateKey", "channel", "recipient");

-- CreateIndex
CREATE INDEX "EmailSmsCampaign_status_scheduledAt_idx" ON "EmailSmsCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_module_action_key" ON "RolePermission"("roleId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_customerId_createdAt_idx" ON "AdminNote"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "FraudFlag_customerId_idx" ON "FraudFlag"("customerId");

-- CreateIndex
CREATE INDEX "FraudFlag_status_idx" ON "FraudFlag"("status");

-- CreateIndex
CREATE INDEX "PromotionalPopup_status_startAt_endAt_idx" ON "PromotionalPopup"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "PromotionalPopup_pageTarget_idx" ON "PromotionalPopup"("pageTarget");

-- CreateIndex
CREATE INDEX "PopupInteraction_popupId_type_idx" ON "PopupInteraction"("popupId", "type");

-- CreateIndex
CREATE INDEX "PopupInteraction_userId_popupId_idx" ON "PopupInteraction"("userId", "popupId");

-- CreateIndex
CREATE INDEX "SeasonalCampaign_status_startDate_endDate_idx" ON "SeasonalCampaign"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "MediaFolder_parentId_idx" ON "MediaFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetTag_name_key" ON "MediaAssetTag"("name");

-- CreateIndex
CREATE INDEX "MediaAsset_folderId_idx" ON "MediaAsset"("folderId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "HomepageLayout_status_idx" ON "HomepageLayout"("status");

-- CreateIndex
CREATE INDEX "HomepageSection_layoutId_idx" ON "HomepageSection"("layoutId");

-- CreateIndex
CREATE INDEX "HeroBannerSlide_sectionId_idx" ON "HeroBannerSlide"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_status_idx" ON "LandingPage"("status");

-- CreateIndex
CREATE INDEX "LandingPageBlock_landingPageId_idx" ON "LandingPageBlock"("landingPageId");

-- CreateIndex
CREATE INDEX "Menu_location_status_idx" ON "Menu"("location", "status");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_parentId_idx" ON "MenuItem"("menuId", "parentId");

-- CreateIndex
CREATE INDEX "ContentVersion_entityType_entityId_idx" ON "ContentVersion"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_entityType_entityId_versionNumber_key" ON "ContentVersion"("entityType", "entityId", "versionNumber");

-- CreateIndex
CREATE INDEX "StoryPageBlock_page_blockType_sortOrder_idx" ON "StoryPageBlock"("page", "blockType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoryPageBlock_page_blockKey_key" ON "StoryPageBlock"("page", "blockKey");

-- CreateIndex
CREATE INDEX "TaxRateRule_region_category_idx" ON "TaxRateRule"("region", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodSetting_key_key" ON "PaymentMethodSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "ExportEnquiry_status_idx" ON "ExportEnquiry"("status");

-- CreateIndex
CREATE INDEX "ExportEnquiry_country_idx" ON "ExportEnquiry"("country");

-- CreateIndex
CREATE INDEX "ExportEnquiry_assignedToId_idx" ON "ExportEnquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "ExportEnquiryNote_enquiryId_idx" ON "ExportEnquiryNote"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributorAccount_userId_key" ON "DistributorAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributorAccount_convertedFromEnquiryId_key" ON "DistributorAccount"("convertedFromEnquiryId");

-- CreateIndex
CREATE INDEX "ProductInteractionEvent_customerId_idx" ON "ProductInteractionEvent"("customerId");

-- CreateIndex
CREATE INDEX "ProductInteractionEvent_productId_idx" ON "ProductInteractionEvent"("productId");

-- CreateIndex
CREATE INDEX "ProductAssociation_sourceProductId_associationType_idx" ON "ProductAssociation"("sourceProductId", "associationType");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssociation_sourceProductId_targetProductId_associat_key" ON "ProductAssociation"("sourceProductId", "targetProductId", "associationType");

-- CreateIndex
CREATE INDEX "RecommendationEvent_productId_idx" ON "RecommendationEvent"("productId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_placement_action_idx" ON "RecommendationEvent"("placement", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEmbedding_productId_key" ON "ProductEmbedding"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEmbedding_sourceType_sourceId_key" ON "ContentEmbedding"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "SearchQueryLog_createdAt_idx" ON "SearchQueryLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_isZeroResult_idx" ON "SearchQueryLog"("isZeroResult");

-- CreateIndex
CREATE UNIQUE INDEX "SearchGlossaryTerm_term_key" ON "SearchGlossaryTerm"("term");

-- CreateIndex
CREATE INDEX "RecipeAssistantConversation_customerId_idx" ON "RecipeAssistantConversation"("customerId");

-- CreateIndex
CREATE INDEX "RecipeAssistantConversation_sessionId_idx" ON "RecipeAssistantConversation"("sessionId");

-- CreateIndex
CREATE INDEX "RecipeAssistantConversation_lastMessageAt_idx" ON "RecipeAssistantConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "RecipeAssistantMessage_conversationId_createdAt_idx" ON "RecipeAssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportAssistantConversation_customerId_idx" ON "SupportAssistantConversation"("customerId");

-- CreateIndex
CREATE INDEX "SupportAssistantConversation_sessionId_idx" ON "SupportAssistantConversation"("sessionId");

-- CreateIndex
CREATE INDEX "SupportAssistantConversation_lastMessageAt_idx" ON "SupportAssistantConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportAssistantMessage_conversationId_createdAt_idx" ON "SupportAssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_slug_key" ON "PolicyDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerChurnScore_customerId_key" ON "CustomerChurnScore"("customerId");

-- CreateIndex
CREATE INDEX "CustomerChurnScore_riskTier_idx" ON "CustomerChurnScore"("riskTier");

-- CreateIndex
CREATE INDEX "BusinessInsightSnapshot_metricType_generatedAt_idx" ON "BusinessInsightSnapshot"("metricType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInsightSnapshot_metricType_periodStart_periodEnd_se_key" ON "BusinessInsightSnapshot"("metricType", "periodStart", "periodEnd", "sequence");

-- CreateIndex
CREATE INDEX "ContactEnquiry_status_idx" ON "ContactEnquiry"("status");

-- CreateIndex
CREATE INDEX "ContactEnquiry_enquiryType_idx" ON "ContactEnquiry"("enquiryType");

-- CreateIndex
CREATE INDEX "ContactEnquiry_createdAt_idx" ON "ContactEnquiry"("createdAt");

-- CreateIndex
CREATE INDEX "_MediaAssetToMediaAssetTag_B_index" ON "_MediaAssetToMediaAssetTag"("B");

-- CreateIndex
CREATE INDEX "RecipeBookmark_customerId_createdAt_idx" ON "RecipeBookmark"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pre-flight safety check (stop condition requested before approval):
-- STORY-045/046 corrected these two FKs to target AdminUser instead of
-- User, per schema.prisma's own comments ("a pre-STORY-038 mistake...
-- corrected here... caught here before anything had ever written to it").
-- AdminUser is a brand-new table in this very migration -- it has zero
-- rows at this point, so if either column holds any non-null legacy
-- value, that value cannot possibly already be a valid AdminUser id.
-- Silently nulling it out would discard a real moderator reference, which
-- was explicitly ruled out -- abort instead and require manual
-- review/mapping before this migration is re-run.
DO $$
DECLARE
  existing_answered_by INT;
  existing_reviewed_by INT;
BEGIN
  SELECT count(*) INTO existing_answered_by FROM "Question" WHERE "answeredById" IS NOT NULL;
  SELECT count(*) INTO existing_reviewed_by FROM "Review" WHERE "reviewedById" IS NOT NULL;

  IF existing_answered_by > 0 OR existing_reviewed_by > 0 THEN
    RAISE EXCEPTION
      'Cannot repoint Question.answeredById (% non-null row(s)) / Review.reviewedById (% non-null row(s)) from User to AdminUser: legacy values exist and AdminUser has no rows yet in this migration. Resolve manually (map or clear with explicit approval) before retrying.',
      existing_answered_by, existing_reviewed_by;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_answeredById_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_reviewedById_fkey";

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeQuestion" ADD CONSTRAINT "RecipeQuestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeQuestion" ADD CONSTRAINT "RecipeQuestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeQuestion" ADD CONSTRAINT "RecipeQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeQuestion" ADD CONSTRAINT "RecipeQuestion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_restrictedToUserId_fkey" FOREIGN KEY ("restrictedToUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponScopeProduct" ADD CONSTRAINT "CouponScopeProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponScopeProduct" ADD CONSTRAINT "CouponScopeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponScopeCategory" ADD CONSTRAINT "CouponScopeCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponScopeCategory" ADD CONSTRAINT "CouponScopeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionScopeProduct" ADD CONSTRAINT "PromotionScopeProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionScopeProduct" ADD CONSTRAINT "PromotionScopeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionScopeCategory" ADD CONSTRAINT "PromotionScopeCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionScopeCategory" ADD CONSTRAINT "PromotionScopeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "RewardTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_expiresEarnedTransactionId_fkey" FOREIGN KEY ("expiresEarnedTransactionId") REFERENCES "RewardTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBadge" ADD CONSTRAINT "CustomerBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBadge" ADD CONSTRAINT "CustomerBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBadge" ADD CONSTRAINT "CustomerBadge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportAssistantConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntegrationEvent" ADD CONSTRAINT "OrderIntegrationEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJobAttempt" ADD CONSTRAINT "SyncJobAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_qualifyingOrderId_fkey" FOREIGN KEY ("qualifyingOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSmsCampaign" ADD CONSTRAINT "EmailSmsCampaign_targetSegmentId_fkey" FOREIGN KEY ("targetSegmentId") REFERENCES "SavedSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSmsCampaign" ADD CONSTRAINT "EmailSmsCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionalPopup" ADD CONSTRAINT "PromotionalPopup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopupInteraction" ADD CONSTRAINT "PopupInteraction_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "PromotionalPopup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopupInteraction" ADD CONSTRAINT "PopupInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalCampaign" ADD CONSTRAINT "SeasonalCampaign_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "PromotionalPopup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalCampaign" ADD CONSTRAINT "SeasonalCampaign_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalCampaign" ADD CONSTRAINT "SeasonalCampaign_emailSmsCampaignId_fkey" FOREIGN KEY ("emailSmsCampaignId") REFERENCES "EmailSmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalCampaign" ADD CONSTRAINT "SeasonalCampaign_homepageSectionId_fkey" FOREIGN KEY ("homepageSectionId") REFERENCES "HomepageSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalCampaign" ADD CONSTRAINT "SeasonalCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFolder" ADD CONSTRAINT "MediaFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageLayout" ADD CONSTRAINT "HomepageLayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageLayout" ADD CONSTRAINT "HomepageLayout_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "HomepageLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroBannerSlide" ADD CONSTRAINT "HeroBannerSlide_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageBlock" ADD CONSTRAINT "LandingPageBlock_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportEnquiry" ADD CONSTRAINT "ExportEnquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportEnquiryNote" ADD CONSTRAINT "ExportEnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "ExportEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportEnquiryNote" ADD CONSTRAINT "ExportEnquiryNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorAccount" ADD CONSTRAINT "DistributorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorAccount" ADD CONSTRAINT "DistributorAccount_convertedFromEnquiryId_fkey" FOREIGN KEY ("convertedFromEnquiryId") REFERENCES "ExportEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorAccount" ADD CONSTRAINT "DistributorAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSegment" ADD CONSTRAINT "SavedSegment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInteractionEvent" ADD CONSTRAINT "ProductInteractionEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInteractionEvent" ADD CONSTRAINT "ProductInteractionEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssociation" ADD CONSTRAINT "ProductAssociation_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssociation" ADD CONSTRAINT "ProductAssociation_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEmbedding" ADD CONSTRAINT "ProductEmbedding_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeAssistantConversation" ADD CONSTRAINT "RecipeAssistantConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeAssistantMessage" ADD CONSTRAINT "RecipeAssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RecipeAssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssistantConversation" ADD CONSTRAINT "SupportAssistantConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssistantMessage" ADD CONSTRAINT "SupportAssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportAssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChurnScore" ADD CONSTRAINT "CustomerChurnScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MediaAssetToMediaAssetTag" ADD CONSTRAINT "_MediaAssetToMediaAssetTag_A_fkey" FOREIGN KEY ("A") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MediaAssetToMediaAssetTag" ADD CONSTRAINT "_MediaAssetToMediaAssetTag_B_fkey" FOREIGN KEY ("B") REFERENCES "MediaAssetTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

