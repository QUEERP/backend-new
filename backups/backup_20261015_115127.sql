--
-- PostgreSQL database dump
--

\restrict bEEW245qEc5yJMhv5f73urxxqoaBIx1F6urCpIYhURNSz1DOoEVr4bncsyff72t

-- Dumped from database version 18.6 (c021049)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."AccountType" AS ENUM (
    'ASSET',
    'LIABILITY',
    'INCOME',
    'EXPENSE',
    'EQUITY'
);


ALTER TYPE public."AccountType" OWNER TO neondb_owner;

--
-- Name: AdjustmentItemType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."AdjustmentItemType" AS ENUM (
    'ADD',
    'SUBTRACT'
);


ALTER TYPE public."AdjustmentItemType" OWNER TO neondb_owner;

--
-- Name: BillStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."BillStatus" AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID'
);


ALTER TYPE public."BillStatus" OWNER TO neondb_owner;

--
-- Name: BillingFrequency; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."BillingFrequency" AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY'
);


ALTER TYPE public."BillingFrequency" OWNER TO neondb_owner;

--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'COMPLETED',
    'TERMINATED'
);


ALTER TYPE public."ContractStatus" OWNER TO neondb_owner;

--
-- Name: Country; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."Country" AS ENUM (
    'INDIA',
    'UAE',
    'AFGHANISTAN',
    'ALBANIA',
    'ALGERIA',
    'ARGENTINA',
    'AUSTRALIA',
    'AUSTRIA',
    'BAHRAIN',
    'BANGLADESH',
    'BELGIUM',
    'BRAZIL',
    'CANADA',
    'CHILE',
    'CHINA',
    'COLOMBIA',
    'CROATIA',
    'CZECH_REPUBLIC',
    'DENMARK',
    'EGYPT',
    'ETHIOPIA',
    'FINLAND',
    'FRANCE',
    'GERMANY',
    'GHANA',
    'GREECE',
    'HONG_KONG',
    'HUNGARY',
    'INDONESIA',
    'IRAN',
    'IRAQ',
    'IRELAND',
    'ISRAEL',
    'ITALY',
    'JAPAN',
    'JORDAN',
    'KAZAKHSTAN',
    'KENYA',
    'KUWAIT',
    'LEBANON',
    'MALAYSIA',
    'MEXICO',
    'MOROCCO',
    'MYANMAR',
    'NEPAL',
    'NETHERLANDS',
    'NEW_ZEALAND',
    'NIGERIA',
    'NORWAY',
    'OMAN',
    'PAKISTAN',
    'PHILIPPINES',
    'POLAND',
    'PORTUGAL',
    'QATAR',
    'ROMANIA',
    'RUSSIA',
    'SAUDI_ARABIA',
    'SINGAPORE',
    'SOUTH_AFRICA',
    'SOUTH_KOREA',
    'SPAIN',
    'SRI_LANKA',
    'SWEDEN',
    'SWITZERLAND',
    'TAIWAN',
    'TANZANIA',
    'THAILAND',
    'TUNISIA',
    'TURKEY',
    'UKRAINE',
    'UNITED_ARAB_EMIRATES',
    'UNITED_KINGDOM',
    'UNITED_STATES',
    'VENEZUELA',
    'VIETNAM',
    'ZIMBABWE',
    'OTHER'
);


ALTER TYPE public."Country" OWNER TO neondb_owner;

--
-- Name: CreatorType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."CreatorType" AS ENUM (
    'Admin',
    'USER'
);


ALTER TYPE public."CreatorType" OWNER TO neondb_owner;

--
-- Name: CreditNoteStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."CreditNoteStatus" AS ENUM (
    'OPEN',
    'CLOSED'
);


ALTER TYPE public."CreditNoteStatus" OWNER TO neondb_owner;

--
-- Name: CreditNoteType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."CreditNoteType" AS ENUM (
    'INVOICE',
    'BILL'
);


ALTER TYPE public."CreditNoteType" OWNER TO neondb_owner;

--
-- Name: CrmAccountType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."CrmAccountType" AS ENUM (
    'CUSTOMER',
    'PARTNER',
    'PROSPECT',
    'RESELLER',
    'VENDOR',
    'OTHER'
);


ALTER TYPE public."CrmAccountType" OWNER TO neondb_owner;

--
-- Name: CrmStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."CrmStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'LEAD',
    'PROSPECT',
    'CHURNED'
);


ALTER TYPE public."CrmStatus" OWNER TO neondb_owner;

--
-- Name: DealStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."DealStatus" AS ENUM (
    'OPEN',
    'WON',
    'LOST'
);


ALTER TYPE public."DealStatus" OWNER TO neondb_owner;

--
-- Name: ExecutionType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ExecutionType" AS ENUM (
    'AUTO_DETECT',
    'SERVICE',
    'PRODUCT',
    'HYBRID'
);


ALTER TYPE public."ExecutionType" OWNER TO neondb_owner;

--
-- Name: GrnStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."GrnStatus" AS ENUM (
    'RECEIVED',
    'CANCELLED'
);


ALTER TYPE public."GrnStatus" OWNER TO neondb_owner;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SENT',
    'PARTIAL_PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."InvoiceStatus" OWNER TO neondb_owner;

--
-- Name: ItemType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ItemType" AS ENUM (
    'GOODS',
    'SERVICE'
);


ALTER TYPE public."ItemType" OWNER TO neondb_owner;

--
-- Name: LeadPriority; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."LeadPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."LeadPriority" OWNER TO neondb_owner;

--
-- Name: LeadSource; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."LeadSource" AS ENUM (
    'WEBSITE',
    'SOCIAL_MEDIA',
    'LINKEDIN',
    'REFERRAL',
    'CALL',
    'OTHER',
    'EXISTING_CUSTOMER',
    'FACEBOOK',
    'GOOGLE',
    'COLD_CALL',
    'WALK_IN',
    'EMAIL',
    'PARTNER',
    'TRADE_SHOW',
    'TENDER'
);


ALTER TYPE public."LeadSource" OWNER TO neondb_owner;

--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'LOST',
    'CONVERTED',
    'UNDER_REVIEW',
    'REQUIREMENT_GATHERING',
    'PROPOSAL_PENDING',
    'PROPOSAL_SENT',
    'NEGOTIATION',
    'WON',
    'CANCELLED'
);


ALTER TYPE public."LeadStatus" OWNER TO neondb_owner;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'BANK_TRANSFER',
    'UPI',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CHEQUE',
    'ONLINE'
);


ALTER TYPE public."PaymentMethod" OWNER TO neondb_owner;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'ON_HOLD'
);


ALTER TYPE public."ProjectStatus" OWNER TO neondb_owner;

--
-- Name: PurchaseOrderStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SENT',
    'PARTIAL_RECEIVED',
    'FULLY_RECEIVED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseOrderStatus" OWNER TO neondb_owner;

--
-- Name: PurchaseRequestStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PurchaseRequestStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'CONVERTED_TO_PO'
);


ALTER TYPE public."PurchaseRequestStatus" OWNER TO neondb_owner;

--
-- Name: PurchaseReturnStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PurchaseReturnStatus" AS ENUM (
    'PENDING',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseReturnStatus" OWNER TO neondb_owner;

--
-- Name: QuotationStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."QuotationStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'ACCEPTED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."QuotationStatus" OWNER TO neondb_owner;

--
-- Name: Region; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."Region" AS ENUM (
    'INDIA',
    'UAE',
    'AFGHANISTAN',
    'ALBANIA',
    'ALGERIA',
    'ARGENTINA',
    'AUSTRALIA',
    'AUSTRIA',
    'BAHRAIN',
    'BANGLADESH',
    'BELGIUM',
    'BRAZIL',
    'CANADA',
    'CHILE',
    'CHINA',
    'COLOMBIA',
    'CROATIA',
    'CZECH_REPUBLIC',
    'DENMARK',
    'EGYPT',
    'ETHIOPIA',
    'FINLAND',
    'FRANCE',
    'GERMANY',
    'GHANA',
    'GREECE',
    'HONG_KONG',
    'HUNGARY',
    'INDONESIA',
    'IRAN',
    'IRAQ',
    'IRELAND',
    'ISRAEL',
    'ITALY',
    'JAPAN',
    'JORDAN',
    'KAZAKHSTAN',
    'KENYA',
    'KUWAIT',
    'LEBANON',
    'MALAYSIA',
    'MEXICO',
    'MOROCCO',
    'MYANMAR',
    'NEPAL',
    'NETHERLANDS',
    'NEW_ZEALAND',
    'NIGERIA',
    'NORWAY',
    'OMAN',
    'PAKISTAN',
    'PHILIPPINES',
    'POLAND',
    'PORTUGAL',
    'QATAR',
    'ROMANIA',
    'RUSSIA',
    'SAUDI_ARABIA',
    'SINGAPORE',
    'SOUTH_AFRICA',
    'SOUTH_KOREA',
    'SPAIN',
    'SRI_LANKA',
    'SWEDEN',
    'SWITZERLAND',
    'TAIWAN',
    'TANZANIA',
    'THAILAND',
    'TUNISIA',
    'TURKEY',
    'UKRAINE',
    'UNITED_ARAB_EMIRATES',
    'UNITED_KINGDOM',
    'UNITED_STATES',
    'VENEZUELA',
    'VIETNAM',
    'ZIMBABWE',
    'OTHER'
);


ALTER TYPE public."Region" OWNER TO neondb_owner;

--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."RequestStatus" OWNER TO neondb_owner;

--
-- Name: SalesOrderStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SalesOrderStatus" AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'PROCESSING',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'INVOICED',
    'CANCELLED'
);


ALTER TYPE public."SalesOrderStatus" OWNER TO neondb_owner;

--
-- Name: SalesReturnStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SalesReturnStatus" AS ENUM (
    'PENDING',
    'RECEIVED',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."SalesReturnStatus" OWNER TO neondb_owner;

--
-- Name: SerialNumberStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SerialNumberStatus" AS ENUM (
    'IN_STOCK',
    'SOLD',
    'TRANSFERRED',
    'DAMAGED',
    'RETURNED'
);


ALTER TYPE public."SerialNumberStatus" OWNER TO neondb_owner;

--
-- Name: StockMovementType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StockMovementType" AS ENUM (
    'PURCHASE_IN',
    'SALE_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RETURN_IN',
    'RETURN_OUT',
    'OPENING_STOCK'
);


ALTER TYPE public."StockMovementType" OWNER TO neondb_owner;

--
-- Name: StockTransferStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StockTransferStatus" AS ENUM (
    'PENDING',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."StockTransferStatus" OWNER TO neondb_owner;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'INACTIVE',
    'ACTIVE',
    'EXPIRED'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO neondb_owner;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'DONE'
);


ALTER TYPE public."TaskStatus" OWNER TO neondb_owner;

--
-- Name: TaxTreatment; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."TaxTreatment" AS ENUM (
    'DOMESTIC',
    'INTERSTATE',
    'EXPORT',
    'IMPORT',
    'ZERO_RATED',
    'REVERSE_CHARGE'
);


ALTER TYPE public."TaxTreatment" OWNER TO neondb_owner;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."UserRole" AS ENUM (
    'USER',
    'ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE'
);


ALTER TYPE public."UserRole" OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AMC; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AMC" (
    id text NOT NULL,
    "amcNumber" text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text,
    "projectId" text,
    "warrantyId" text,
    "contractValue" double precision DEFAULT 0 NOT NULL,
    "amcType" text,
    coverage text,
    "visitFrequency" text,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "renewalDate" timestamp(3) without time zone,
    "assignedEngineerId" text,
    sla text,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "paymentStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AMC" OWNER TO neondb_owner;

--
-- Name: AMCRenewal; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AMCRenewal" (
    id text NOT NULL,
    "amcId" text NOT NULL,
    "businessId" text NOT NULL,
    "renewalDate" timestamp(3) without time zone NOT NULL,
    amount double precision NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL
);


ALTER TABLE public."AMCRenewal" OWNER TO neondb_owner;

--
-- Name: AMCVisit; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AMCVisit" (
    id text NOT NULL,
    "amcId" text NOT NULL,
    "businessId" text NOT NULL,
    "visitDate" timestamp(3) without time zone NOT NULL,
    "engineerId" text,
    status text DEFAULT 'SCHEDULED'::text NOT NULL,
    notes text
);


ALTER TABLE public."AMCVisit" OWNER TO neondb_owner;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    type public."AccountType" NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Account" OWNER TO neondb_owner;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    "leadId" text,
    "dealId" text,
    "customerId" text,
    "assignedToId" text,
    "activityDate" timestamp(3) without time zone NOT NULL,
    duration integer,
    status text DEFAULT 'Scheduled'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    attendees jsonb,
    "contactId" text,
    "deletedAt" timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "isAllDay" boolean DEFAULT false NOT NULL,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "meetingLink" text,
    outcome text,
    priority text,
    "reminderAt" timestamp(3) without time zone
);


ALTER TABLE public."Activity" OWNER TO neondb_owner;

--
-- Name: BankChangeRequest; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BankChangeRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "businessId" text NOT NULL,
    "bankName" text NOT NULL,
    "accountNumber" text NOT NULL,
    "accountHolderName" text NOT NULL,
    status public."RequestStatus" DEFAULT 'PENDING'::public."RequestStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "Code" text NOT NULL,
    country text NOT NULL
);


ALTER TABLE public."BankChangeRequest" OWNER TO neondb_owner;

--
-- Name: Bill; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Bill" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "billNumber" text NOT NULL,
    status public."BillStatus" DEFAULT 'UNPAID'::public."BillStatus" NOT NULL,
    "vendorId" text NOT NULL,
    "purchaseOrderId" text,
    subtotal double precision NOT NULL,
    tax double precision,
    discount double precision,
    "totalAmount" double precision NOT NULL,
    "billDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "grnId" text,
    "outstandingAmount" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public."Bill" OWNER TO neondb_owner;

--
-- Name: BillItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BillItem" (
    id text NOT NULL,
    "billId" text NOT NULL,
    name text NOT NULL,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    total double precision NOT NULL,
    "productId" text,
    "warehouseId" text,
    "taxCategory" text
);


ALTER TABLE public."BillItem" OWNER TO neondb_owner;

--
-- Name: Campaign; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Campaign" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    budget double precision,
    "actualCost" double precision,
    "expectedRevenue" double precision,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    description text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Campaign" OWNER TO neondb_owner;

--
-- Name: Contract; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Contract" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    title text NOT NULL,
    description text,
    value double precision NOT NULL,
    currency text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "isHidden" boolean DEFAULT false NOT NULL,
    status public."ContractStatus" DEFAULT 'ACTIVE'::public."ContractStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "typeId" text
);


ALTER TABLE public."Contract" OWNER TO neondb_owner;

--
-- Name: ContractType; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ContractType" (
    id text NOT NULL,
    name text NOT NULL,
    "businessId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ContractType" OWNER TO neondb_owner;

--
-- Name: CreditNote; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CreditNote" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text,
    "invoiceId" text,
    "creditNumber" text NOT NULL,
    amount double precision NOT NULL,
    "remainingAmount" double precision NOT NULL,
    reason text,
    status public."CreditNoteStatus" DEFAULT 'OPEN'::public."CreditNoteStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "pdfUrl" text,
    type public."CreditNoteType" NOT NULL,
    "vendorId" text,
    "deletedAt" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "salesReturnId" text,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public."CreditNote" OWNER TO neondb_owner;

--
-- Name: CrmTask; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CrmTask" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "reminderAt" timestamp(3) without time zone,
    "leadId" text,
    "dealId" text,
    "customerId" text,
    "contactId" text,
    "assignedToId" text,
    "createdById" text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CrmTask" OWNER TO neondb_owner;

--
-- Name: CustomerContact; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CustomerContact" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "businessId" text NOT NULL,
    "fullName" text NOT NULL,
    email text,
    "position" text,
    phone text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "contactOwnerId" text,
    "deletedAt" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    tags text[]
);


ALTER TABLE public."CustomerContact" OWNER TO neondb_owner;

--
-- Name: Deal; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Deal" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    "customerId" text NOT NULL,
    "contactId" text,
    stage text DEFAULT 'New'::text NOT NULL,
    probability integer,
    "expectedCloseDate" timestamp(3) without time zone,
    source text,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedToId" text,
    "campaignId" text,
    "deletedAt" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "lostReason" text,
    status public."DealStatus" DEFAULT 'OPEN'::public."DealStatus" NOT NULL
);


ALTER TABLE public."Deal" OWNER TO neondb_owner;

--
-- Name: DealStageHistory; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DealStageHistory" (
    id text NOT NULL,
    "dealId" text NOT NULL,
    "fromStage" text NOT NULL,
    "toStage" text NOT NULL,
    "changedById" text,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DealStageHistory" OWNER TO neondb_owner;

--
-- Name: DebitNote; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DebitNote" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "vendorId" text NOT NULL,
    "billId" text,
    "purchaseReturnId" text,
    "debitNumber" text NOT NULL,
    amount double precision NOT NULL,
    "remainingAmount" double precision NOT NULL,
    reason text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    currency text DEFAULT 'AED'::text NOT NULL,
    "transactionCurrencyId" text,
    "baseCurrencyId" text,
    "exchangeRate" double precision DEFAULT 1.0 NOT NULL,
    "baseCurrencyAmount" double precision DEFAULT 0.0 NOT NULL,
    "statutoryExchangeRate" double precision DEFAULT 1.0 NOT NULL,
    "statutoryBaseAmount" double precision DEFAULT 0.0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DebitNote" OWNER TO neondb_owner;

--
-- Name: DebitNoteItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DebitNoteItem" (
    id text NOT NULL,
    "debitNoteId" text NOT NULL,
    "productId" text,
    "itemName" text,
    description text,
    quantity double precision NOT NULL,
    rate double precision NOT NULL,
    "itemType" text DEFAULT 'GOODS'::text,
    unit text,
    "taxPercent" double precision
);


ALTER TABLE public."DebitNoteItem" OWNER TO neondb_owner;

--
-- Name: DeliveryNote; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DeliveryNote" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    "salesOrderId" text,
    "deliveryNumber" text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "taxPointTrigger" text DEFAULT 'INVOICE'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DeliveryNote" OWNER TO neondb_owner;

--
-- Name: DeliveryNoteItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DeliveryNoteItem" (
    id text NOT NULL,
    "deliveryNoteId" text NOT NULL,
    "productId" text,
    "warehouseId" text,
    "itemName" text,
    quantity double precision NOT NULL,
    unit text
);


ALTER TABLE public."DeliveryNoteItem" OWNER TO neondb_owner;

--
-- Name: DocumentAuditLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."DocumentAuditLog" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "documentId" text NOT NULL,
    action text NOT NULL,
    "performedBy" text,
    comments text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DocumentAuditLog" OWNER TO neondb_owner;

--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."EmailLog" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    "fromEmail" text NOT NULL,
    "toEmail" text NOT NULL,
    status text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "leadId" text,
    "dealId" text,
    "customerId" text,
    "contactId" text,
    attachments jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."EmailLog" OWNER TO neondb_owner;

--
-- Name: Employee; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Employee" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    designation text,
    "joinDate" timestamp(3) without time zone,
    "basicSalary" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    allowance jsonb,
    deduction jsonb,
    "leaveBalance" jsonb,
    "userId" text,
    "accountHolderName" text,
    "accountNumber" text,
    "bankName" text,
    "Code" text
);


ALTER TABLE public."Employee" OWNER TO neondb_owner;

--
-- Name: Expense; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Expense" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    title text NOT NULL,
    amount double precision NOT NULL,
    category text,
    "paymentMethod" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    notes text,
    "vendorId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvalComments" text,
    "costCenter" text,
    department text,
    "employeeId" text,
    "financeId" text,
    "managerId" text,
    "projectId" text,
    status text DEFAULT 'Draft'::text NOT NULL,
    "taskId" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    currency text DEFAULT 'AED'::text,
    "customerId" text,
    "referenceId" text,
    "referenceType" text,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public."Expense" OWNER TO neondb_owner;

--
-- Name: ExpenseAuditLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ExpenseAuditLog" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "expenseId" text NOT NULL,
    action text NOT NULL,
    "performedBy" text,
    comments text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ExpenseAuditLog" OWNER TO neondb_owner;

--
-- Name: ExpenseItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ExpenseItem" (
    id text NOT NULL,
    "expenseId" text NOT NULL,
    "itemName" text,
    description text NOT NULL,
    quantity double precision,
    rate double precision,
    "taxPercent" double precision,
    "taxAmount" double precision,
    amount double precision NOT NULL,
    category text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ExpenseItem" OWNER TO neondb_owner;

--
-- Name: InvoiceAuditLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."InvoiceAuditLog" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "invoiceId" text NOT NULL,
    action text NOT NULL,
    "performedBy" text,
    comments text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."InvoiceAuditLog" OWNER TO neondb_owner;

--
-- Name: JournalEntry; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."JournalEntry" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "accountId" text NOT NULL,
    debit double precision DEFAULT 0 NOT NULL,
    credit double precision DEFAULT 0 NOT NULL,
    description text,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision,
    "baseCredit" double precision,
    "baseDebit" double precision,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryCredit" double precision,
    "statutoryDebit" double precision,
    "statutoryRate" double precision
);


ALTER TABLE public."JournalEntry" OWNER TO neondb_owner;

--
-- Name: Lead; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Lead" (
    id text NOT NULL,
    name text NOT NULL,
    "position" text,
    email text,
    phone text,
    company text,
    website text,
    city text,
    state text,
    country text,
    "zipCode" text,
    "leadValue" double precision,
    description text,
    "isPublic" boolean DEFAULT false NOT NULL,
    "contactedToday" boolean DEFAULT false NOT NULL,
    "defaultLanguage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    status public."LeadStatus" DEFAULT 'NEW'::public."LeadStatus" NOT NULL,
    source public."LeadSource" NOT NULL,
    "stageId" text,
    "businessId" text NOT NULL,
    tags text[],
    "assignedToId" text,
    "campaignId" text,
    "deletedAt" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    "budgetRange" text,
    "businessRequirement" text,
    "businessUnit" text,
    "companySize" text,
    "competitorName" text,
    competitors text,
    currency text,
    "currentBusinessProblem" text,
    deliverables text,
    department text,
    "estimatedTeamSize" integer,
    "executionType" public."ExecutionType" DEFAULT 'AUTO_DETECT'::public."ExecutionType" NOT NULL,
    "expectedCompletionDate" timestamp(3) without time zone,
    "expectedDecisionDate" timestamp(3) without time zone,
    "expectedDuration" text,
    "expectedMargin" double precision,
    "expectedProfit" double precision,
    "expectedRevenue" double precision,
    "expectedSolution" text,
    "expectedStartDate" timestamp(3) without time zone,
    "followUpNotes" text,
    "gstVatNumber" text,
    industry text,
    "inquiryNumber" text,
    "inquiryTitle" text,
    "inquiryType" text,
    "internalNotes" text,
    "managementNotes" text,
    "meetingDate" timestamp(3) without time zone,
    "meetingLocation" text,
    "meetingType" text,
    "nextFollowUpDate" timestamp(3) without time zone,
    "preferredCommunication" text,
    priority public."LeadPriority" DEFAULT 'MEDIUM'::public."LeadPriority" NOT NULL,
    probability integer,
    "projectType" text,
    reminder boolean DEFAULT false NOT NULL,
    "riskLevel" text,
    "salesStrategy" text,
    "scopeSummary" text,
    timezone text,
    "winProbability" integer,
    "customerId" text,
    "requirementId" text
);


ALTER TABLE public."Lead" OWNER TO neondb_owner;

--
-- Name: LeadActivity; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeadActivity" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LeadActivity" OWNER TO neondb_owner;

--
-- Name: LeadConversionLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeadConversionLog" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "leadId" text NOT NULL,
    "customerId" text NOT NULL,
    "contactId" text,
    "dealId" text,
    "convertedById" text,
    "convertedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LeadConversionLog" OWNER TO neondb_owner;

--
-- Name: LeadNote; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeadNote" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    note text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LeadNote" OWNER TO neondb_owner;

--
-- Name: LeadReminder; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeadReminder" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    title text NOT NULL,
    date timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LeadReminder" OWNER TO neondb_owner;

--
-- Name: LeadTask; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeadTask" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    title text NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LeadTask" OWNER TO neondb_owner;

--
-- Name: Leave; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Leave" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "employeeId" text NOT NULL,
    "leaveCode" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    duration text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL
);


ALTER TABLE public."Leave" OWNER TO neondb_owner;

--
-- Name: Loan; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Loan" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "businessId" text NOT NULL,
    "totalAmount" double precision NOT NULL,
    "remainingAmount" double precision NOT NULL,
    "emiAmount" double precision NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Loan" OWNER TO neondb_owner;

--
-- Name: Note; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Note" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    content text NOT NULL,
    "leadId" text,
    "dealId" text,
    "customerId" text,
    "contactId" text,
    "createdById" text,
    attachments jsonb,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Note" OWNER TO neondb_owner;

--
-- Name: Overtime; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Overtime" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "businessId" text NOT NULL,
    "overtimeHours" double precision NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Overtime" OWNER TO neondb_owner;

--
-- Name: Payroll; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Payroll" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Payroll" OWNER TO neondb_owner;

--
-- Name: Payslip; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Payslip" (
    id text NOT NULL,
    "payrollId" text NOT NULL,
    "employeeId" text NOT NULL,
    "basicSalary" double precision NOT NULL,
    allowance double precision DEFAULT 0 NOT NULL,
    deduction double precision DEFAULT 0 NOT NULL,
    "netSalary" double precision NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "pdfUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "employeeName" text NOT NULL,
    "overtimePay" double precision DEFAULT 0 NOT NULL,
    "loanDeduction" double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."Payslip" OWNER TO neondb_owner;

--
-- Name: PipelineStage; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PipelineStage" (
    id text NOT NULL,
    name text NOT NULL,
    "order" integer NOT NULL,
    color text
);


ALTER TABLE public."PipelineStage" OWNER TO neondb_owner;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    description text,
    sku text NOT NULL,
    price double precision NOT NULL,
    "costPrice" double precision NOT NULL,
    "taxPercent" double precision DEFAULT 0 NOT NULL,
    unit text DEFAULT 'pcs'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "taxCode" text,
    type public."ItemType" NOT NULL,
    attachments jsonb,
    barcode text,
    "brandId" text,
    "categoryId" text,
    image text,
    "isBatchTracking" boolean DEFAULT false NOT NULL,
    "isSerialTracking" boolean DEFAULT false NOT NULL,
    "minimumStock" double precision DEFAULT 0 NOT NULL,
    "openingStock" double precision DEFAULT 0 NOT NULL,
    "reorderLevel" double precision DEFAULT 0 NOT NULL,
    "unitId" text,
    "taxCategory" text
);


ALTER TABLE public."Product" OWNER TO neondb_owner;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectCode" text NOT NULL,
    "projectName" text NOT NULL,
    "customerId" text NOT NULL,
    "projectManagerId" text,
    department text,
    "categoryId" text,
    "typeId" text,
    priority text,
    status public."ProjectStatus" DEFAULT 'ACTIVE'::public."ProjectStatus" NOT NULL,
    budget double precision DEFAULT 0 NOT NULL,
    revenue double precision DEFAULT 0 NOT NULL,
    "expectedProfit" double precision DEFAULT 0 NOT NULL,
    "actualCost" double precision DEFAULT 0 NOT NULL,
    "committedCost" double precision DEFAULT 0 NOT NULL,
    "laborCost" double precision DEFAULT 0 NOT NULL,
    "materialCost" double precision DEFAULT 0 NOT NULL,
    "invoicedRevenue" double precision DEFAULT 0 NOT NULL,
    "collectedRevenue" double precision DEFAULT 0 NOT NULL,
    "estimatedHours" double precision DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "completionPercentage" double precision DEFAULT 0 NOT NULL,
    "quotationId" text,
    "salesOrderId" text,
    "executionType" text DEFAULT 'SERVICE'::text,
    "billingMethod" text,
    "templateId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    note text,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public."Project" OWNER TO neondb_owner;

--
-- Name: ProjectBudget; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectBudget" (
    id text NOT NULL,
    "budgetCode" text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "customerId" text,
    "requirementId" text,
    "estimateId" text,
    department text,
    "approvedBudget" double precision DEFAULT 0 NOT NULL,
    "actualCost" double precision DEFAULT 0 NOT NULL,
    "committedCost" double precision DEFAULT 0 NOT NULL,
    "remainingBudget" double precision DEFAULT 0 NOT NULL,
    variance double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    currency text,
    "projectManagerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public."ProjectBudget" OWNER TO neondb_owner;

--
-- Name: ProjectBudgetHistory; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectBudgetHistory" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "oldBudget" double precision NOT NULL,
    "newBudget" double precision NOT NULL,
    difference double precision NOT NULL,
    reason text,
    remarks text,
    "approvedById" text,
    "effectiveDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectBudgetHistory" OWNER TO neondb_owner;

--
-- Name: ProjectChangeRequest; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectChangeRequest" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "requestNumber" text,
    title text,
    "requestedById" text,
    "assignedToId" text,
    reason text,
    "scopeChange" text,
    "timelineImpact" text,
    "costImpact" double precision,
    priority text DEFAULT 'Medium'::text,
    impact text DEFAULT 'Medium'::text,
    status text DEFAULT 'Draft'::text NOT NULL,
    "approvalStatus" text DEFAULT 'Pending Approval'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectChangeRequest" OWNER TO neondb_owner;

--
-- Name: ProjectDocument; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectDocument" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text,
    title text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileType" text,
    "fileSize" integer,
    "mimeType" text,
    "uploadedById" text,
    folder text DEFAULT 'General'::text,
    "entityType" text,
    "entityId" text,
    version integer DEFAULT 1 NOT NULL,
    "parentDocId" text,
    tags text[] DEFAULT ARRAY[]::text[],
    description text,
    permission text DEFAULT 'Owner'::text,
    "downloadCount" integer DEFAULT 0 NOT NULL,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectDocument" OWNER TO neondb_owner;

--
-- Name: ProjectEstimation; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectEstimation" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    title text NOT NULL,
    "requirementId" text,
    "materialCost" double precision DEFAULT 0 NOT NULL,
    "labourCost" double precision DEFAULT 0 NOT NULL,
    "machineCost" double precision DEFAULT 0 NOT NULL,
    "subcontractCost" double precision DEFAULT 0 NOT NULL,
    "travelCost" double precision DEFAULT 0 NOT NULL,
    "miscCost" double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    "profitMargin" double precision DEFAULT 0 NOT NULL,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    "internalNotes" text,
    status text DEFAULT 'Draft'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectEstimation" OWNER TO neondb_owner;

--
-- Name: ProjectIssue; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectIssue" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "issueCode" text,
    title text NOT NULL,
    description text,
    module text,
    severity text,
    priority text,
    impact text,
    "rootCause" text,
    "reporterId" text,
    "assigneeId" text,
    resolution text,
    status text DEFAULT 'Open'::text NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectIssue" OWNER TO neondb_owner;

--
-- Name: ProjectItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectItem" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "itemName" text NOT NULL,
    description text,
    quantity double precision DEFAULT 1 NOT NULL,
    rate double precision DEFAULT 0 NOT NULL,
    amount double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."ProjectItem" OWNER TO neondb_owner;

--
-- Name: ProjectMaster; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectMaster" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    config jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectMaster" OWNER TO neondb_owner;

--
-- Name: ProjectMeeting; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectMeeting" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text,
    title text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    attendees text,
    "createdBy" text,
    "customerId" text,
    "inquiryId" text,
    "meetingDate" text NOT NULL,
    "meetingTime" text NOT NULL,
    "meetingType" text NOT NULL,
    notes text,
    "requirementId" text,
    status text DEFAULT 'Scheduled'::text NOT NULL
);


ALTER TABLE public."ProjectMeeting" OWNER TO neondb_owner;

--
-- Name: ProjectMilestone; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectMilestone" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    name text NOT NULL,
    description text,
    "ownerId" text,
    weight double precision DEFAULT 0 NOT NULL,
    "dueDate" timestamp(3) without time zone,
    status text DEFAULT 'Pending'::text NOT NULL,
    completion double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectMilestone" OWNER TO neondb_owner;

--
-- Name: ProjectPlanning; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectPlanning" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "planCode" text NOT NULL,
    "planName" text NOT NULL,
    phase text,
    sprint text,
    "execType" text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    priority text,
    description text,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "expectedCompletion" timestamp(3) without time zone,
    duration integer,
    "workingDays" integer,
    milestone text,
    dependency text,
    "projectManagerId" text,
    department text,
    "taskOwnerId" text,
    resources integer,
    "estimatedHours" double precision DEFAULT 0 NOT NULL,
    "billableHours" double precision DEFAULT 0 NOT NULL,
    "resourceCost" double precision DEFAULT 0 NOT NULL,
    "taskTitle" text,
    "subTask" text,
    sequence integer,
    "criticalTask" boolean DEFAULT false NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    reminder integer,
    "initialProgress" double precision DEFAULT 0 NOT NULL,
    "currentProgress" double precision DEFAULT 0 NOT NULL,
    "completionPercentage" double precision DEFAULT 0 NOT NULL,
    "progressStatus" text,
    "riskLevel" text,
    "estimatedCost" double precision DEFAULT 0 NOT NULL,
    "actualCost" double precision DEFAULT 0 NOT NULL,
    variance double precision DEFAULT 0 NOT NULL,
    currency text,
    comments text,
    "privateNotes" text,
    approvals text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectPlanning" OWNER TO neondb_owner;

--
-- Name: ProjectRequirement; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectRequirement" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "requirementNumber" text NOT NULL,
    title text NOT NULL,
    "customerId" text NOT NULL,
    "contactId" text,
    "businessType" text,
    department text,
    priority text,
    "expectedBudget" double precision,
    "assignedEmployeeId" text,
    description text,
    tags text[],
    source text,
    location text,
    status text DEFAULT 'Draft'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    company text,
    "contactPerson" text,
    country text,
    "createdBy" text,
    currency text,
    deliverables jsonb,
    email text,
    "executionType" text,
    phone text,
    "projectType" text,
    team jsonb,
    timezone text,
    "acceptanceCriteria" text,
    "actualEndDate" timestamp(3) without time zone,
    "actualStartDate" timestamp(3) without time zone,
    "apiDataRequirements" text,
    "assumptionsDependencies" text,
    attachments jsonb,
    authentication text,
    "authorization" text,
    "backupStrategy" text,
    "billingModel" text,
    "browserSupport" text,
    "brsDependencies" text,
    "brsRisks" text,
    "budgetRange" text,
    "budgetRisk" text,
    "businessObjective" text,
    "businessRisk" text,
    "businessRules" text,
    "completionPercentage" double precision,
    "complianceRequirements" text,
    constraints text,
    "coreBusinessRequirement" text,
    "currentProblem" text,
    database text,
    "decisionDeadline" timestamp(3) without time zone,
    "dependencyRisk" text,
    "disasterRecovery" text,
    "estimatedCost" double precision,
    "estimatedDuration" text,
    "existingProcess" text,
    "expectedEnd" timestamp(3) without time zone,
    "expectedMargin" double precision,
    "expectedProfit" double precision,
    "expectedRevenue" double precision,
    "expectedSolution" text,
    "expectedStart" timestamp(3) without time zone,
    "futureProcess" text,
    "hardwareRequirements" text,
    "hostingPreference" text,
    "implementationNotes" text,
    "inScope" text,
    industry text,
    "infrastructureRequirements" text,
    "managementApprovalNotes" text,
    "managementApprovalRequired" boolean DEFAULT false NOT NULL,
    "mitigationPlan" text,
    "mobileSupport" text,
    "networkRequirements" text,
    "outOfScope" text,
    "overallRisk" text,
    "paymentTerms" text,
    "performanceRequirement" text,
    "preferredCommunication" text,
    "projectSize" text,
    "requirementAnalysisNotes" text,
    "requirementDate" timestamp(3) without time zone,
    "salesObservations" text,
    "securityCompliance" text,
    "successCriteria" text,
    "supportEndDate" timestamp(3) without time zone,
    "supportNotes" text,
    "targetGoLive" timestamp(3) without time zone,
    "technicalRisk" text,
    "technologyStack" text,
    "thirdPartyIntegrations" text,
    "timelineRisk" text,
    "warrantyEndDate" timestamp(3) without time zone,
    website text,
    "categoryId" text
);


ALTER TABLE public."ProjectRequirement" OWNER TO neondb_owner;

--
-- Name: ProjectRisk; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectRisk" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    title text NOT NULL,
    description text,
    probability text,
    impact text,
    mitigation text,
    status text DEFAULT 'Active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectRisk" OWNER TO neondb_owner;

--
-- Name: ProjectTask; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectTask" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "milestoneId" text,
    "taskNumber" text NOT NULL,
    title text NOT NULL,
    description text,
    priority text,
    status public."TaskStatus" DEFAULT 'TODO'::public."TaskStatus" NOT NULL,
    "assignedToId" text,
    "startDate" timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "estimatedHours" double precision DEFAULT 0 NOT NULL,
    "actualHours" double precision DEFAULT 0 NOT NULL,
    "completionPercentage" double precision DEFAULT 0 NOT NULL,
    checklist jsonb,
    dependencies jsonb,
    "assignedTeam" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public."ProjectTask" OWNER TO neondb_owner;

--
-- Name: ProjectTemplate; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProjectTemplate" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProjectTemplate" OWNER TO neondb_owner;

--
-- Name: PurchaseOrder; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PurchaseOrder" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "poNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "assignedToId" text,
    subtotal double precision NOT NULL,
    tax double precision,
    discount double precision,
    "totalAmount" double precision NOT NULL,
    "orderDate" timestamp(3) without time zone NOT NULL,
    "expectedDeliveryDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "warehouseId" text,
    status public."PurchaseOrderStatus" DEFAULT 'DRAFT'::public."PurchaseOrderStatus" NOT NULL,
    "projectId" text,
    "currencyCode" text DEFAULT 'AED'::text,
    "currencySymbol" text DEFAULT 'AED'::text,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public."PurchaseOrder" OWNER TO neondb_owner;

--
-- Name: PurchaseOrderItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PurchaseOrderItem" (
    id text NOT NULL,
    "purchaseOrderId" text NOT NULL,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    total double precision NOT NULL,
    description text NOT NULL,
    "hsnSacCode" text,
    "itemType" text,
    "productId" text,
    "taxPercent" double precision DEFAULT 0,
    "warehouseId" text
);


ALTER TABLE public."PurchaseOrderItem" OWNER TO neondb_owner;

--
-- Name: Quotation; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Quotation" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "quoteNumber" text NOT NULL,
    title text,
    "customerId" text NOT NULL,
    "dealId" text,
    "assignedToId" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiryDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    cgst double precision DEFAULT 0,
    "contactId" text,
    currency text DEFAULT 'INR'::text NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    emirate text,
    "ewayBillNo" text,
    igst double precision DEFAULT 0,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "reverseCharge" boolean DEFAULT false,
    sgst double precision DEFAULT 0,
    "shippingCharges" double precision DEFAULT 0 NOT NULL,
    tds double precision DEFAULT 0,
    "termsConditions" text,
    "transportDetails" text,
    "vatAmount" double precision DEFAULT 0,
    "vatPercentage" double precision DEFAULT 0,
    "vatType" text,
    status public."QuotationStatus" DEFAULT 'DRAFT'::public."QuotationStatus" NOT NULL,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public."Quotation" OWNER TO neondb_owner;

--
-- Name: QuotationItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."QuotationItem" (
    id text NOT NULL,
    "quotationId" text NOT NULL,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    total double precision NOT NULL,
    "cgstPercent" double precision DEFAULT 0,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text NOT NULL,
    discount double precision DEFAULT 0,
    "hsnSacCode" text,
    "igstPercent" double precision DEFAULT 0,
    "itemType" text DEFAULT 'GOODS'::text,
    "productId" text,
    "sgstPercent" double precision DEFAULT 0,
    "taxDetails" jsonb,
    "taxPercent" double precision DEFAULT 0,
    unit text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "itemName" text,
    "warehouseId" text
);


ALTER TABLE public."QuotationItem" OWNER TO neondb_owner;

--
-- Name: ResourceAllocation; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ResourceAllocation" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "taskId" text,
    "employeeId" text NOT NULL,
    department text,
    role text,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "estimatedHours" double precision DEFAULT 0 NOT NULL,
    "allocationPercent" double precision DEFAULT 100 NOT NULL,
    priority text,
    notes text,
    status text DEFAULT 'Active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ResourceAllocation" OWNER TO neondb_owner;

--
-- Name: SalesOrder; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."SalesOrder" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "orderNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "quotationId" text,
    "dealId" text,
    "assignedToId" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "orderDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveryDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    cgst double precision DEFAULT 0,
    "contactId" text,
    currency text DEFAULT 'INR'::text NOT NULL,
    "customerReference" text,
    "deletedAt" timestamp(3) without time zone,
    "deliveryInstructions" text,
    emirate text,
    "ewayBillNo" text,
    igst double precision DEFAULT 0,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "paymentTerms" text,
    "placeOfSupply" text,
    "reverseCharge" boolean DEFAULT false,
    sgst double precision DEFAULT 0,
    "shippingCharges" double precision DEFAULT 0 NOT NULL,
    "shippingMethod" text,
    tds double precision DEFAULT 0,
    "termsConditions" text,
    "transportDetails" text,
    "vatAmount" double precision DEFAULT 0,
    "vatPercentage" double precision DEFAULT 0,
    "vatType" text,
    status public."SalesOrderStatus" DEFAULT 'DRAFT'::public."SalesOrderStatus" NOT NULL,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public."SalesOrder" OWNER TO neondb_owner;

--
-- Name: SalesOrderItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."SalesOrderItem" (
    id text NOT NULL,
    "salesOrderId" text NOT NULL,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    total double precision NOT NULL,
    "cgstPercent" double precision DEFAULT 0,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text NOT NULL,
    discount double precision DEFAULT 0,
    "hsnSacCode" text,
    "igstPercent" double precision DEFAULT 0,
    "itemType" text DEFAULT 'GOODS'::text,
    "productId" text,
    "sgstPercent" double precision DEFAULT 0,
    "taxDetails" jsonb,
    "taxPercent" double precision DEFAULT 0,
    unit text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "warehouseId" text
);


ALTER TABLE public."SalesOrderItem" OWNER TO neondb_owner;

--
-- Name: Settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Settings" (
    id integer NOT NULL,
    "businessId" text NOT NULL,
    "companyName" text NOT NULL,
    address text,
    phone text,
    email text,
    website text,
    trn text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "accountName" text,
    "accountNumber" text,
    "bankAddress" text,
    "bankName" text,
    "companyLogo" text,
    iban text,
    "swiftCode" text,
    "defaultFooterNote" text,
    "defaultTerms" text,
    "invoiceFormat" text DEFAULT 'INV-YYYY-MM-DD-COUNT'::text NOT NULL,
    "signatureUrl" text,
    "leaveTypes" jsonb,
    "overtimeThreshold" double precision DEFAULT 2 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    "currencySymbol" text DEFAULT '₹'::text NOT NULL,
    "invoiceTemplate" text DEFAULT 'modern'::text NOT NULL,
    "valuationMethod" text DEFAULT 'FIFO'::text NOT NULL,
    "barcodeTracking" boolean DEFAULT false NOT NULL,
    "batchTracking" boolean DEFAULT false NOT NULL,
    "creditNotePrefix" text,
    "defaultTaxSettings" jsonb,
    "defaultWarehouseId" text,
    "digitalSignature" text,
    "exportSettings" jsonb,
    "fiscalYear" text,
    ifsc text,
    "importSettings" jsonb,
    "invoicePrefix" text,
    "negativeStock" boolean DEFAULT false NOT NULL,
    "paymentPrefix" text,
    "placeOfSupply" text,
    "purchaseOrderPrefix" text,
    "quotationPrefix" text,
    "reverseCharge" boolean DEFAULT false NOT NULL,
    "salesOrderPrefix" text,
    "serialTracking" boolean DEFAULT false NOT NULL,
    "overtimeTracking" text,
    "taxConfiguration" text,
    weekend text
);


ALTER TABLE public."Settings" OWNER TO neondb_owner;

--
-- Name: Settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Settings_id_seq" OWNER TO neondb_owner;

--
-- Name: Settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Settings_id_seq" OWNED BY public."Settings".id;


--
-- Name: Stock; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Stock" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "warehouseId" text NOT NULL,
    quantity double precision DEFAULT 0 NOT NULL,
    "reservedQty" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "averageCost" double precision DEFAULT 0 NOT NULL,
    "damagedQty" double precision DEFAULT 0 NOT NULL,
    "incomingQty" double precision DEFAULT 0 NOT NULL,
    "locationId" text
);


ALTER TABLE public."Stock" OWNER TO neondb_owner;

--
-- Name: TaxFramework; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TaxFramework" (
    id text NOT NULL,
    "countryId" text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public."TaxFramework" OWNER TO neondb_owner;

--
-- Name: TaxRate; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TaxRate" (
    id text NOT NULL,
    "taxTypeId" text NOT NULL,
    name text NOT NULL,
    rate double precision NOT NULL,
    "effectiveFrom" timestamp(3) without time zone NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "taxRuleId" text
);


ALTER TABLE public."TaxRate" OWNER TO neondb_owner;

--
-- Name: TaxTransaction; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TaxTransaction" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "transactionType" text NOT NULL,
    "transactionId" text NOT NULL,
    "taxRateId" text,
    "taxAmountTxnCcy" double precision NOT NULL,
    "taxAmountBaseCcy" double precision NOT NULL,
    "taxableAmountBaseCcy" double precision DEFAULT 0 NOT NULL,
    "taxAmountStatutoryCcy" double precision,
    "transactionCurrencyId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isManualOverride" boolean DEFAULT false NOT NULL,
    "itemReference" text,
    "overriddenAt" timestamp(3) without time zone,
    "overriddenBy" text,
    "overrideRate" double precision,
    "overrideReason" text,
    "overrideTaxTypeId" text
);


ALTER TABLE public."TaxTransaction" OWNER TO neondb_owner;

--
-- Name: TaxType; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TaxType" (
    id text NOT NULL,
    "taxFrameworkId" text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public."TaxType" OWNER TO neondb_owner;

--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Ticket" (
    id text NOT NULL,
    "ticketNumber" text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text,
    "projectId" text,
    "amcId" text,
    "warrantyId" text,
    subject text NOT NULL,
    description text NOT NULL,
    category text,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "assignedEngineerId" text,
    "expectedResolution" timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Ticket" OWNER TO neondb_owner;

--
-- Name: TicketAttachment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TicketAttachment" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "businessId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TicketAttachment" OWNER TO neondb_owner;

--
-- Name: TicketComment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TicketComment" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "businessId" text NOT NULL,
    "userId" text,
    comment text NOT NULL,
    "isInternal" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TicketComment" OWNER TO neondb_owner;

--
-- Name: TimeEntry; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TimeEntry" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text NOT NULL,
    "taskId" text,
    description text,
    hours double precision NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "businessUserId" text,
    "employeeId" text,
    billable boolean DEFAULT true NOT NULL,
    overtime double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL
);


ALTER TABLE public."TimeEntry" OWNER TO neondb_owner;

--
-- Name: Vendor; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Vendor" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    address text,
    city text,
    country text,
    "isActive" boolean DEFAULT true NOT NULL,
    state text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "vatNumber" text,
    website text,
    "zipCode" text,
    balance double precision DEFAULT 0 NOT NULL,
    "companyName" text,
    "paymentTerms" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "taxNumber" text,
    "contactPerson" text,
    "countryCode" text,
    "createdBy" text,
    "creditLimit" double precision,
    currency text,
    notes text,
    "openingBalance" double precision DEFAULT 0 NOT NULL,
    "preferredVendor" boolean DEFAULT false NOT NULL,
    "taxRegistrationNumber" text,
    "updatedBy" text,
    "vendorCode" text,
    "vendorType" text
);


ALTER TABLE public."Vendor" OWNER TO neondb_owner;

--
-- Name: Warehouse; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Warehouse" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    country text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    code text,
    manager text,
    type text DEFAULT 'STANDARD'::text
);


ALTER TABLE public."Warehouse" OWNER TO neondb_owner;

--
-- Name: Warranty; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Warranty" (
    id text NOT NULL,
    "warrantyNumber" text NOT NULL,
    "businessId" text NOT NULL,
    "projectId" text,
    "customerId" text,
    equipment text,
    "serialNumber" text,
    manufacturer text,
    "warrantyProvider" text,
    "warrantyType" text,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "coverageDetails" text,
    terms text,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Warranty" OWNER TO neondb_owner;

--
-- Name: WarrantyAttachment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."WarrantyAttachment" (
    id text NOT NULL,
    "warrantyId" text NOT NULL,
    "businessId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WarrantyAttachment" OWNER TO neondb_owner;

--
-- Name: WarrantyReminder; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."WarrantyReminder" (
    id text NOT NULL,
    "warrantyId" text NOT NULL,
    "businessId" text NOT NULL,
    "reminderDate" timestamp(3) without time zone NOT NULL,
    message text,
    "isSent" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."WarrantyReminder" OWNER TO neondb_owner;

--
-- Name: _CustomerToLead; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."_CustomerToLead" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


ALTER TABLE public."_CustomerToLead" OWNER TO neondb_owner;

--
-- Name: _SettingsToUser; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."_SettingsToUser" (
    "A" integer NOT NULL,
    "B" text NOT NULL
);


ALTER TABLE public."_SettingsToUser" OWNER TO neondb_owner;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO neondb_owner;

--
-- Name: attendances; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.attendances (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "employeeId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status text NOT NULL,
    "checkIn" timestamp(3) without time zone,
    "checkOut" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.attendances OWNER TO neondb_owner;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "userId" text,
    "userEmail" text,
    action text NOT NULL,
    module text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    details jsonb,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batches (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "productId" text NOT NULL,
    "batchNumber" text NOT NULL,
    "expiryDate" timestamp(3) without time zone,
    "mfgDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.batches OWNER TO neondb_owner;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.brands (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.brands OWNER TO neondb_owner;

--
-- Name: business_users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.business_users (
    id text NOT NULL,
    "userId" text NOT NULL,
    "businessId" text NOT NULL,
    "roleId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.business_users OWNER TO neondb_owner;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.businesses (
    id text NOT NULL,
    name text NOT NULL,
    "ownerId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "businessType" text,
    city text,
    country public."Country" DEFAULT 'INDIA'::public."Country" NOT NULL,
    currency text,
    description text,
    emirate text,
    "financialYearEnd" timestamp(3) without time zone,
    "financialYearStart" timestamp(3) without time zone,
    "gstNumber" text,
    "gstRegistrationType" text,
    industry text,
    language text,
    "legalName" text,
    "msmeNumber" text,
    pan text,
    "pinCode" text,
    state text,
    tan text,
    "timeZone" text,
    "vatNumber" text,
    "vatRegistrationDate" timestamp(3) without time zone,
    "vatRegistrationType" text,
    "countryCode" text,
    "currencyCode" text,
    "currencySymbol" text,
    "taxType" text,
    "baseCurrencyId" text,
    "countryId" text,
    "taxFrameworkId" text
);


ALTER TABLE public.businesses OWNER TO neondb_owner;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.categories (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    "parentId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    description text
);


ALTER TABLE public.categories OWNER TO neondb_owner;

--
-- Name: compliance_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.compliance_rules (
    id text NOT NULL,
    "businessId" text,
    "modelName" text NOT NULL,
    "fieldName" text NOT NULL,
    "ruleType" text DEFAULT 'REQUIRED'::text NOT NULL,
    condition jsonb,
    severity text DEFAULT 'WARNING'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.compliance_rules OWNER TO neondb_owner;

--
-- Name: compliance_tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.compliance_tasks (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "ruleId" text NOT NULL,
    "modelName" text NOT NULL,
    "recordId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.compliance_tasks OWNER TO neondb_owner;

--
-- Name: countries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.countries (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.countries OWNER TO neondb_owner;

--
-- Name: currencies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.currencies (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    decimals integer DEFAULT 2 NOT NULL,
    "decimalPrecision" integer DEFAULT 2 NOT NULL
);


ALTER TABLE public.currencies OWNER TO neondb_owner;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customers (
    id text NOT NULL,
    "businessId" text NOT NULL,
    phone text,
    address text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "billingCity" text,
    "billingCountry" text,
    "billingState" text,
    "billingStreet" text,
    "billingZipCode" text,
    city text,
    company text NOT NULL,
    country text,
    currency text DEFAULT 'SYSTEM'::text NOT NULL,
    "defaultLanguage" text DEFAULT 'SYSTEM'::text NOT NULL,
    "group" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "shippingCity" text,
    "shippingCountry" text,
    "shippingState" text,
    "shippingStreet" text,
    "shippingZipCode" text,
    state text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "vatNumber" text,
    website text,
    "zipCode" text,
    "leadId" text,
    region public."Region" NOT NULL,
    "accountOwnerId" text,
    "accountType" public."CrmAccountType",
    "annualRevenue" double precision,
    "crmStatus" public."CrmStatus",
    "deletedAt" timestamp(3) without time zone,
    description text,
    "employeeCount" integer,
    "facebookUrl" text,
    industry text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "lastContactedAt" timestamp(3) without time zone,
    "linkedinUrl" text,
    "parentAccountId" text,
    tags text[],
    "twitterUrl" text,
    "accountName" text,
    "accountNumber" text,
    "bankName" text,
    iban text,
    "swiftCode" text
);


ALTER TABLE public.customers OWNER TO neondb_owner;

--
-- Name: exchange_rate_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exchange_rate_rules (
    id text NOT NULL,
    "countryId" text NOT NULL,
    "baseCurrencyId" text NOT NULL,
    "requiresStatutoryRate" boolean DEFAULT false NOT NULL,
    "statutoryRateSource" text
);


ALTER TABLE public.exchange_rate_rules OWNER TO neondb_owner;

--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exchange_rates (
    id text NOT NULL,
    "fromCurrencyId" text NOT NULL,
    "toCurrencyId" text NOT NULL,
    rate double precision NOT NULL,
    "effectiveDate" timestamp(3) without time zone NOT NULL,
    source text,
    "rateType" text DEFAULT 'COMMERCIAL'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text
);


ALTER TABLE public.exchange_rates OWNER TO neondb_owner;

--
-- Name: goods_receive_note_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.goods_receive_note_items (
    id text NOT NULL,
    "grnId" text NOT NULL,
    "productId" text NOT NULL,
    "quantityOrdered" double precision NOT NULL,
    "quantityReceived" double precision NOT NULL,
    "quantityDamaged" double precision DEFAULT 0 NOT NULL,
    price double precision DEFAULT 0 NOT NULL,
    "batchNumber" text,
    "serialNumbers" text[]
);


ALTER TABLE public.goods_receive_note_items OWNER TO neondb_owner;

--
-- Name: goods_receive_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.goods_receive_notes (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "grnNumber" text NOT NULL,
    "purchaseOrderId" text,
    "vendorId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "receivedDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."GrnStatus" DEFAULT 'RECEIVED'::public."GrnStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.goods_receive_notes OWNER TO neondb_owner;

--
-- Name: inventory_layers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory_layers (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "productId" text NOT NULL,
    "warehouseId" text NOT NULL,
    quantity double precision NOT NULL,
    "remainingQty" double precision NOT NULL,
    "unitCost" double precision NOT NULL,
    "transactionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "referenceType" text NOT NULL,
    "referenceId" text,
    "isDepleted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.inventory_layers OWNER TO neondb_owner;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_items (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    description text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hours double precision NOT NULL,
    rate double precision NOT NULL,
    "taxDetails" jsonb,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "totalTax" double precision DEFAULT 0 NOT NULL,
    "cgstPercent" double precision DEFAULT 0,
    "cogsAmount" double precision DEFAULT 0,
    discount double precision DEFAULT 0 NOT NULL,
    "grossMarginPercent" double precision DEFAULT 0,
    "grossProfit" double precision DEFAULT 0,
    "hsnSacCode" text,
    "igstPercent" double precision DEFAULT 0,
    "itemType" text,
    "productId" text,
    quantity double precision DEFAULT 1 NOT NULL,
    "sgstPercent" double precision DEFAULT 0,
    "taxPercent" double precision DEFAULT 0,
    unit text,
    "unitCost" double precision DEFAULT 0,
    "valuationMethodUsed" text,
    "warehouseId" text,
    "itemName" text,
    "taxCategory" text
);


ALTER TABLE public.invoice_items OWNER TO neondb_owner;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    "invoiceNumber" text NOT NULL,
    status public."InvoiceStatus" DEFAULT 'UNPAID'::public."InvoiceStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "adminNote" text,
    currency text DEFAULT 'AED'::text NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "grandTotal" double precision DEFAULT 0 NOT NULL,
    "invoiceDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "poDate" timestamp(3) without time zone,
    "poNumber" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    terms text,
    "totalTax" double precision DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "pdfUrl" text,
    "salesOrderId" text,
    "projectId" text,
    cgst double precision DEFAULT 0,
    "contactId" text,
    "deletedAt" timestamp(3) without time zone,
    "designTemplate" text DEFAULT 'modern'::text NOT NULL,
    emirate text,
    "ewayBillNo" text,
    igst double precision DEFAULT 0,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "quotationId" text,
    "reverseCharge" boolean DEFAULT false,
    sgst double precision DEFAULT 0,
    "shippingCharges" double precision DEFAULT 0 NOT NULL,
    "soDate" timestamp(3) without time zone,
    "soNumber" text,
    tds double precision DEFAULT 0,
    "totalCogs" double precision DEFAULT 0,
    "totalGrossProfit" double precision DEFAULT 0,
    "transportDetails" text,
    "vatAmount" double precision DEFAULT 0,
    "vatPercentage" double precision DEFAULT 0,
    "vatType" text,
    "amountPaid" double precision DEFAULT 0 NOT NULL,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public.invoices OWNER TO neondb_owner;

--
-- Name: modules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.modules (
    id text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.modules OWNER TO neondb_owner;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "userId" text,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'INFO'::text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "entityType" text,
    "entityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_allocations (
    id text NOT NULL,
    "paymentId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "allocatedAmount" double precision NOT NULL,
    "allocationType" text NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payment_allocations OWNER TO neondb_owner;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payments (
    id text NOT NULL,
    "invoiceId" text,
    "businessId" text NOT NULL,
    amount double precision NOT NULL,
    "paymentDate" timestamp(3) without time zone NOT NULL,
    "paymentMode" text NOT NULL,
    "transactionId" text,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text NOT NULL,
    "pdfUrl" text,
    "paymentNumber" text NOT NULL,
    "billId" text,
    "customerId" text,
    "quotationId" text,
    "amountAllocated" double precision DEFAULT 0 NOT NULL,
    "projectId" text,
    status text DEFAULT 'unapplied'::text NOT NULL,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text
);


ALTER TABLE public.payments OWNER TO neondb_owner;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    action text NOT NULL,
    "moduleId" text NOT NULL
);


ALTER TABLE public.permissions OWNER TO neondb_owner;

--
-- Name: purchase_request_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_request_items (
    id text NOT NULL,
    "purchaseRequestId" text NOT NULL,
    "productId" text NOT NULL,
    description text,
    quantity double precision NOT NULL,
    "estimatedPrice" double precision DEFAULT 0
);


ALTER TABLE public.purchase_request_items OWNER TO neondb_owner;

--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_requests (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "requestNumber" text NOT NULL,
    department text,
    "requesterId" text,
    status public."PurchaseRequestStatus" DEFAULT 'DRAFT'::public."PurchaseRequestStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "projectId" text,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "exchangeRate" double precision,
    "isLegacyUntracked" boolean DEFAULT false NOT NULL,
    "rateIsEstimated" boolean DEFAULT false NOT NULL,
    "statutoryBaseAmount" double precision,
    "statutoryExchangeRate" double precision,
    "transactionCurrencyId" text,
    priority text,
    "requiredDate" timestamp(3) without time zone,
    title text,
    "vendorId" text
);


ALTER TABLE public.purchase_requests OWNER TO neondb_owner;

--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_return_items (
    id text NOT NULL,
    "purchaseReturnId" text NOT NULL,
    "productId" text NOT NULL,
    description text,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    "taxPercent" double precision DEFAULT 0,
    total double precision NOT NULL,
    "warehouseId" text,
    "isStockReturned" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.purchase_return_items OWNER TO neondb_owner;

--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_returns (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "returnNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "billId" text,
    "grnId" text,
    status public."PurchaseReturnStatus" DEFAULT 'PENDING'::public."PurchaseReturnStatus" NOT NULL,
    reason text,
    "refundStatus" text DEFAULT 'PENDING'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision DEFAULT 1.0,
    "baseCurrencyAmount" double precision,
    "baseCurrencyId" text,
    "transactionCurrencyId" text
);


ALTER TABLE public.purchase_returns OWNER TO neondb_owner;

--
-- Name: recurring_invoice_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.recurring_invoice_items (
    id text NOT NULL,
    "recurringInvoiceId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    "itemType" text DEFAULT 'GOODS'::text,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    "taxPercent" double precision DEFAULT 0,
    "taxDetails" jsonb,
    total double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.recurring_invoice_items OWNER TO neondb_owner;

--
-- Name: recurring_invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.recurring_invoices (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    "profileName" text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    frequency public."BillingFrequency" DEFAULT 'MONTHLY'::public."BillingFrequency" NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "lastInvoiceDate" timestamp(3) without time zone,
    "nextInvoiceDate" timestamp(3) without time zone,
    currency text DEFAULT 'INR'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    "totalTax" double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "grandTotal" double precision DEFAULT 0 NOT NULL,
    notes text,
    terms text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public.recurring_invoices OWNER TO neondb_owner;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO neondb_owner;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    "businessId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.roles OWNER TO neondb_owner;

--
-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_return_items (
    id text NOT NULL,
    "salesReturnId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    price double precision NOT NULL,
    "taxPercent" double precision DEFAULT 0,
    total double precision NOT NULL,
    "warehouseId" text,
    "isStockReturned" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.sales_return_items OWNER TO neondb_owner;

--
-- Name: sales_returns; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_returns (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    "invoiceId" text,
    "salesOrderId" text,
    "returnNumber" text NOT NULL,
    status public."SalesReturnStatus" DEFAULT 'PENDING'::public."SalesReturnStatus" NOT NULL,
    reason text,
    "refundStatus" text DEFAULT 'PENDING'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    currency text DEFAULT 'AED'::text,
    "exchangeRate" double precision DEFAULT 1.0
);


ALTER TABLE public.sales_returns OWNER TO neondb_owner;

--
-- Name: serial_numbers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.serial_numbers (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "productId" text NOT NULL,
    "batchId" text,
    "serialNumber" text NOT NULL,
    status public."SerialNumberStatus" DEFAULT 'IN_STOCK'::public."SerialNumberStatus" NOT NULL,
    "warehouseId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.serial_numbers OWNER TO neondb_owner;

--
-- Name: stock_adjustment_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_adjustment_items (
    id text NOT NULL,
    "stockAdjustmentId" text NOT NULL,
    "productId" text NOT NULL,
    quantity double precision NOT NULL,
    type public."AdjustmentItemType" NOT NULL,
    "batchNumber" text,
    "serialNumbers" text[]
);


ALTER TABLE public.stock_adjustment_items OWNER TO neondb_owner;

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_adjustments (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "adjustmentNumber" text NOT NULL,
    "warehouseId" text NOT NULL,
    reason text,
    "adjustmentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "locationId" text
);


ALTER TABLE public.stock_adjustments OWNER TO neondb_owner;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_movements (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "productId" text NOT NULL,
    "warehouseId" text NOT NULL,
    quantity double precision NOT NULL,
    type public."StockMovementType" NOT NULL,
    "referenceType" text,
    "referenceId" text,
    "performedBy" text,
    notes text,
    "balanceAfter" double precision,
    "invoiceId" text,
    "referenceNo" text,
    "salesOrderId" text,
    "unitCost" double precision,
    "valuationMethod" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "locationId" text
);


ALTER TABLE public.stock_movements OWNER TO neondb_owner;

--
-- Name: stock_transfer_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_transfer_items (
    id text NOT NULL,
    "stockTransferId" text NOT NULL,
    "productId" text NOT NULL,
    quantity double precision NOT NULL,
    "batchNumber" text,
    "serialNumbers" text[]
);


ALTER TABLE public.stock_transfer_items OWNER TO neondb_owner;

--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_transfers (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "transferNumber" text NOT NULL,
    "fromWarehouseId" text NOT NULL,
    "toWarehouseId" text NOT NULL,
    "transferDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "fromLocationId" text,
    "toLocationId" text,
    status public."StockTransferStatus" DEFAULT 'PENDING'::public."StockTransferStatus" NOT NULL
);


ALTER TABLE public.stock_transfers OWNER TO neondb_owner;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    "businessId" text NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'INACTIVE'::public."SubscriptionStatus" NOT NULL,
    "startDate" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "planName" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO neondb_owner;

--
-- Name: tax_account_mappings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tax_account_mappings (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "taxRuleId" text NOT NULL,
    "accountId" text NOT NULL,
    type text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tax_account_mappings OWNER TO neondb_owner;

--
-- Name: tax_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tax_rules (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    rate double precision NOT NULL,
    type text NOT NULL,
    jurisdiction text,
    "isRecoverable" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "autoProvisioned" boolean DEFAULT false NOT NULL,
    "taxCategory" text,
    "counterpartyTaxRegistrationStatus" text,
    "countryCode" text,
    "placeOfSupply" text,
    priority integer DEFAULT 0 NOT NULL,
    "regionCode" text,
    "supplyCategory" text
);


ALTER TABLE public.tax_rules OWNER TO neondb_owner;

--
-- Name: units; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.units (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    abbreviation text
);


ALTER TABLE public.units OWNER TO neondb_owner;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_permissions (
    id text NOT NULL,
    "businessUserId" text NOT NULL,
    "permissionId" text NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "activeBusinessId" text,
    "resetToken" text,
    "resetTokenExpiry" timestamp(3) without time zone
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: warehouse_locations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.warehouse_locations (
    id text NOT NULL,
    "warehouseId" text NOT NULL,
    code text NOT NULL,
    name text,
    "locationType" text DEFAULT 'BIN'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.warehouse_locations OWNER TO neondb_owner;

--
-- Name: Settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Settings" ALTER COLUMN id SET DEFAULT nextval('public."Settings_id_seq"'::regclass);


--
-- Data for Name: AMC; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."AMC" (id, "amcNumber", "businessId", "customerId", "projectId", "warrantyId", "contractValue", "amcType", coverage, "visitFrequency", "startDate", "endDate", "renewalDate", "assignedEngineerId", sla, notes, status, "paymentStatus", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AMCRenewal; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."AMCRenewal" (id, "amcId", "businessId", "renewalDate", amount, status) FROM stdin;
\.


--
-- Data for Name: AMCVisit; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."AMCVisit" (id, "amcId", "businessId", "visitDate", "engineerId", status, notes) FROM stdin;
\.


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Account" (id, "businessId", name, type, code, "isActive", "createdAt") FROM stdin;
93c74ef1-5fb6-4dcc-9b43-e3fe49668181	0e3a949d-40de-49a6-8237-672be813ae83	VAT Payable	LIABILITY	L-101	t	2026-07-13 13:03:09.658
45a4a7b3-415d-4103-abc4-06b0f17d4cdb	0e3a949d-40de-49a6-8237-672be813ae83	VAT Receivable	ASSET	A-102	t	2026-07-13 13:03:09.658
b039d195-60d6-4a16-b79f-05b53b576c7a	0e3a949d-40de-49a6-8237-672be813ae83	Sales Revenue	INCOME	I-201	t	2026-07-13 13:03:09.658
e0eb00e6-c515-4a5f-8b9d-14e8e16ea40e	0e3a949d-40de-49a6-8237-672be813ae83	Cost of Goods Sold	EXPENSE	E-301	t	2026-07-13 13:03:09.658
921ce39d-7da4-4c35-ac90-7afa51997a2a	61888ae9-df55-4f14-a800-eb2a50fe4b56	VAT Payable	LIABILITY	L-101	t	2026-07-13 13:03:28.421
df142130-db39-4167-9ea4-f9100b6a4af1	61888ae9-df55-4f14-a800-eb2a50fe4b56	VAT Receivable	ASSET	A-102	t	2026-07-13 13:03:28.421
8613ffa5-0cf0-436d-842b-a55e4a8e1529	61888ae9-df55-4f14-a800-eb2a50fe4b56	Sales Revenue	INCOME	I-201	t	2026-07-13 13:03:28.421
0c3d7c9d-b0ee-40fe-9271-494db7d3af7a	61888ae9-df55-4f14-a800-eb2a50fe4b56	Cost of Goods Sold	EXPENSE	E-301	t	2026-07-13 13:03:28.421
f4f1dab5-1ec5-43ce-b99f-e6a769ab578e	d0adb689-c9f0-438c-981c-8deaab49681f	CGST Payable	LIABILITY	L-101	t	2026-07-14 11:22:34.742
736fba53-b9fa-4121-aa70-f581189e5cc6	d0adb689-c9f0-438c-981c-8deaab49681f	SGST Payable	LIABILITY	L-102	t	2026-07-14 11:22:34.742
11a8df6b-fc8a-4473-badd-5e0ed0b401ad	d0adb689-c9f0-438c-981c-8deaab49681f	IGST Payable	LIABILITY	L-103	t	2026-07-14 11:22:34.742
79de85c1-5385-416a-b291-2693f8a27170	d0adb689-c9f0-438c-981c-8deaab49681f	Sales Revenue	INCOME	I-201	t	2026-07-14 11:22:34.742
3e572141-9d1e-4e1a-9270-bf5a81d76b84	d0adb689-c9f0-438c-981c-8deaab49681f	Cost of Goods Sold	EXPENSE	E-301	t	2026-07-14 11:22:34.742
dc4f983b-86f4-4d4f-b82e-35ff4886185a	f8e9fbaf-18c7-4518-8bcd-0830cac0406e	CGST Payable	LIABILITY	L-101	t	2026-07-20 13:02:02.316
5c06cf28-5aa8-4a64-a751-d3797ecb430d	f8e9fbaf-18c7-4518-8bcd-0830cac0406e	SGST Payable	LIABILITY	L-102	t	2026-07-20 13:02:02.316
1426bae0-fc88-48e2-ba31-843eb9b57af9	f8e9fbaf-18c7-4518-8bcd-0830cac0406e	IGST Payable	LIABILITY	L-103	t	2026-07-20 13:02:02.316
5dab727a-d671-4e93-afc5-a55953749b92	f8e9fbaf-18c7-4518-8bcd-0830cac0406e	Sales Revenue	INCOME	I-201	t	2026-07-20 13:02:02.316
14b5eb95-f8b6-4b70-aeb8-a1358019b0ec	f8e9fbaf-18c7-4518-8bcd-0830cac0406e	Cost of Goods Sold	EXPENSE	E-301	t	2026-07-20 13:02:02.316
b42f6ed8-286d-4e10-801e-af5de293fcf1	5f4c2981-e1a0-46f6-bc9f-51964647bf34	CGST Payable	LIABILITY	L-101	t	2026-07-31 06:36:11.672
47d75dc9-1ce2-4316-acc8-7d974724529e	5f4c2981-e1a0-46f6-bc9f-51964647bf34	SGST Payable	LIABILITY	L-102	t	2026-07-31 06:36:11.672
14676b84-580c-40e8-ac2e-9a6910dc359c	5f4c2981-e1a0-46f6-bc9f-51964647bf34	IGST Payable	LIABILITY	L-103	t	2026-07-31 06:36:11.672
713791ef-9295-428c-b0f6-a079f0097aac	5f4c2981-e1a0-46f6-bc9f-51964647bf34	Sales Revenue	INCOME	I-201	t	2026-07-31 06:36:11.672
806ae3ce-9843-4c11-a15e-6c13fb7f38bc	5f4c2981-e1a0-46f6-bc9f-51964647bf34	Cost of Goods Sold	EXPENSE	E-301	t	2026-07-31 06:36:11.672
2d5a0f57-5de2-47de-8bb6-3eba90d335f6	ec0f4bc3-2c6c-487b-990d-b5bd327afb73	CGST Payable	LIABILITY	L-101	t	2026-08-02 05:40:51.976
121dfa50-8711-463d-a8a1-80770e84d87e	ec0f4bc3-2c6c-487b-990d-b5bd327afb73	SGST Payable	LIABILITY	L-102	t	2026-08-02 05:40:51.976
1515be1e-406d-4e91-98fc-d5ff1bfda097	ec0f4bc3-2c6c-487b-990d-b5bd327afb73	IGST Payable	LIABILITY	L-103	t	2026-08-02 05:40:51.976
dd4ba8af-0a70-4bd1-9ed8-53db33ac0cfb	ec0f4bc3-2c6c-487b-990d-b5bd327afb73	Sales Revenue	INCOME	I-201	t	2026-08-02 05:40:51.976
88071627-a287-4c0b-994f-b74d518e9ae2	ec0f4bc3-2c6c-487b-990d-b5bd327afb73	Cost of Goods Sold	EXPENSE	E-301	t	2026-08-02 05:40:51.976
422d0ad1-25e4-4bc1-a541-b6252fbd27e4	dc70ca38-b141-477d-a379-f02649117a78	CGST Payable	LIABILITY	L-101	t	2026-09-16 05:45:31.757
1e18d557-1772-4aa6-b0da-094e66ce1dd2	dc70ca38-b141-477d-a379-f02649117a78	SGST Payable	LIABILITY	L-102	t	2026-09-16 05:45:31.757
db0e55a4-0aac-47e3-885d-34c5458f7341	dc70ca38-b141-477d-a379-f02649117a78	IGST Payable	LIABILITY	L-103	t	2026-09-16 05:45:31.757
2a481df5-f802-46be-9217-1d1c2ed23cd6	dc70ca38-b141-477d-a379-f02649117a78	Sales Revenue	INCOME	I-201	t	2026-09-16 05:45:31.757
16864eac-807d-484f-aeaa-0a48597720ad	dc70ca38-b141-477d-a379-f02649117a78	Cost of Goods Sold	EXPENSE	E-301	t	2026-09-16 05:45:31.757
0da695d9-5f08-4aa0-9932-0cb9da4e9e86	c58f432d-2463-43ba-b84b-c1936db0dac4	CGST Payable	LIABILITY	L-101	t	2026-09-17 15:43:47.099
7c9fcd26-e3f4-4af5-8404-8c7606c61ff0	c58f432d-2463-43ba-b84b-c1936db0dac4	SGST Payable	LIABILITY	L-102	t	2026-09-17 15:43:47.099
6f824f40-8e31-4665-b1db-34f6b3858e37	c58f432d-2463-43ba-b84b-c1936db0dac4	IGST Payable	LIABILITY	L-103	t	2026-09-17 15:43:47.099
e6945763-dff1-475f-b3b5-6a2f2a33d591	c58f432d-2463-43ba-b84b-c1936db0dac4	Sales Revenue	INCOME	I-201	t	2026-09-17 15:43:47.099
fbf11a81-ff51-4fee-8a33-c3ad6080c2ec	c58f432d-2463-43ba-b84b-c1936db0dac4	Cost of Goods Sold	EXPENSE	E-301	t	2026-09-17 15:43:47.099
1dc05231-6d43-4d61-9447-1cee77013d4c	0ecaed9c-a29b-47c3-8138-ff8a98ad0155	CGST Payable	LIABILITY	L-101	t	2026-09-21 06:48:03.124
1b12eeef-8f39-4992-b823-ff1ea23e5b11	0ecaed9c-a29b-47c3-8138-ff8a98ad0155	SGST Payable	LIABILITY	L-102	t	2026-09-21 06:48:03.124
101bc7a5-dc55-4cd5-a00d-68c7f8c4fd96	0ecaed9c-a29b-47c3-8138-ff8a98ad0155	IGST Payable	LIABILITY	L-103	t	2026-09-21 06:48:03.124
d637e4e2-cebc-4c33-a014-fcee97ea47bf	0ecaed9c-a29b-47c3-8138-ff8a98ad0155	Sales Revenue	INCOME	I-201	t	2026-09-21 06:48:03.124
fd331eb1-2572-4d8b-b363-13030f22dea8	0ecaed9c-a29b-47c3-8138-ff8a98ad0155	Cost of Goods Sold	EXPENSE	E-301	t	2026-09-21 06:48:03.124
699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	dc70ca38-b141-477d-a379-f02649117a78	Cash & Bank	ASSET	SYSTEM_CASH	t	2026-09-21 09:44:04.935
021019c2-9f79-42ea-a937-c77777b50c9c	dc70ca38-b141-477d-a379-f02649117a78	que info tech	LIABILITY	que02	f	2026-09-21 09:14:56.865
362c2c97-3c24-42c6-b8d0-391babce3f98	dc70ca38-b141-477d-a379-f02649117a78	Cash	ASSET	\N	t	2026-09-21 09:17:15.101
88844246-b4ae-4e04-87f9-1a7f8e955949	dc70ca38-b141-477d-a379-f02649117a78	Bank	ASSET	\N	t	2026-09-21 09:17:15.101
415f67e1-c4ac-4d3f-866f-a8e465fcd28d	dc70ca38-b141-477d-a379-f02649117a78	Accounts Receivable	ASSET	\N	t	2026-09-21 09:17:15.101
13416dd3-4bb7-4f76-8650-3bf581ae1655	dc70ca38-b141-477d-a379-f02649117a78	Accounts Payable	LIABILITY	\N	t	2026-09-21 09:17:15.101
9a799458-d3af-4b44-a636-71498c1deee5	dc70ca38-b141-477d-a379-f02649117a78	Tax Payable	LIABILITY	\N	t	2026-09-21 09:17:15.101
696adb8d-aaba-474b-b388-ae7a68aa23b0	dc70ca38-b141-477d-a379-f02649117a78	Sales	INCOME	\N	t	2026-09-21 09:17:15.101
d5c10fc9-3bc4-4559-b9d6-fffb218d5ce5	dc70ca38-b141-477d-a379-f02649117a78	Purchase	EXPENSE	\N	t	2026-09-21 09:17:15.101
9f2fae5d-af74-49d1-bf2b-c5658126d039	dc70ca38-b141-477d-a379-f02649117a78	Rent Expense	EXPENSE	\N	t	2026-09-21 09:17:15.101
a496f04d-1bfa-42ec-953e-ec2ab4ac0956	dc70ca38-b141-477d-a379-f02649117a78	Salary Expense	EXPENSE	\N	t	2026-09-21 09:17:15.101
9607a046-6aee-4aaa-8469-80177c97784d	dc70ca38-b141-477d-a379-f02649117a78	Owner Capital	EQUITY	\N	t	2026-09-21 09:17:15.101
ab146364-df05-4455-a6a2-5233ced6ccf5	dc70ca38-b141-477d-a379-f02649117a78	Accounts Receivable	ASSET	SYSTEM_AR	t	2026-09-21 09:44:05.051
be98c58f-b553-40be-aaa4-5dc6dda88bf0	dc70ca38-b141-477d-a379-f02649117a78	Accounts Payable	LIABILITY	SYSTEM_AP	t	2026-09-21 09:44:05.167
aaaf6c1a-f3d9-4437-8ca0-219a9851a83d	dc70ca38-b141-477d-a379-f02649117a78	Sales Revenue	INCOME	SYSTEM_REVENUE	t	2026-09-21 09:44:05.284
c384c926-8457-49d1-a060-49d81268d623	dc70ca38-b141-477d-a379-f02649117a78	Cost of Goods Sold	EXPENSE	SYSTEM_COGS	t	2026-09-21 09:44:05.399
f8bcba70-fbdc-492d-b62c-afb621db173d	dc70ca38-b141-477d-a379-f02649117a78	Sales Returns	INCOME	SYSTEM_SALES_RETURN	t	2026-09-21 09:44:05.515
2f6320c4-73af-42d0-88ef-43f0c12cc6d0	dc70ca38-b141-477d-a379-f02649117a78	Inventory Asset	ASSET	SYSTEM_INVENTORY	t	2026-09-21 09:44:05.63
7838c0be-8c45-487c-8f46-ede477b3f29f	dc70ca38-b141-477d-a379-f02649117a78	Customer Advances	LIABILITY	SYSTEM_CUSTOMER_ADVANCE	t	2026-09-21 09:44:05.744
a538f7c0-2eaf-4824-ba96-f7eaeb2eec15	dc70ca38-b141-477d-a379-f02649117a78	Employee Loans Receivable	ASSET	SYSTEM_EMPLOYEE_LOAN	t	2026-09-21 09:44:05.86
adb4c229-b043-46af-b4db-d39f4da66b26	dc70ca38-b141-477d-a379-f02649117a78	Purchase Returns	EXPENSE	SYSTEM_PURCHASE_RETURN	t	2026-09-21 09:44:05.974
257b51b0-35f8-4255-9561-e4626935389c	dc70ca38-b141-477d-a379-f02649117a78	Salary & Wages	EXPENSE	SYSTEM_SALARY_EXPENSE	t	2026-09-21 09:44:06.089
72573bbb-5183-4557-8cb6-5a6db501af14	dc70ca38-b141-477d-a379-f02649117a78	Stock Adjustments	EXPENSE	SYSTEM_STOCK_ADJUSTMENT	t	2026-09-21 09:44:06.207
3d4398f7-6b11-4761-8147-3f2117ebdaff	dc70ca38-b141-477d-a379-f02649117a78	Tax Payable	LIABILITY	SYSTEM_TAX_PAYABLE	t	2026-09-21 09:44:06.322
a0222fd4-f712-41a4-b703-5413b57707e4	dc70ca38-b141-477d-a379-f02649117a78	Tax Receivable	ASSET	SYSTEM_TAX_RECEIVABLE	t	2026-09-21 09:44:06.436
bd164c1d-2a6a-4e7e-86da-54cba6fd7f23	dc70ca38-b141-477d-a379-f02649117a78	Realized FX Gain/Loss	EXPENSE	SYSTEM_FX_GAIN_LOSS	t	2026-09-21 09:44:06.552
51c75bae-af92-46c1-bb23-f92a6ea4eaef	dc70ca38-b141-477d-a379-f02649117a78	Rent	EXPENSE	\N	t	2026-09-21 09:44:06.668
ea25d9cf-9b23-4755-a51a-e3b8dbf3a1b0	dc70ca38-b141-477d-a379-f02649117a78	test ACdhdh	LIABILITY	626172u	f	2026-09-30 09:59:51.1
64df1f95-de8a-4faa-ad64-1e271c13bbac	2ca3a8e3-fa44-42af-9455-679707a2c984	CGST Payable	LIABILITY	L-101	t	2026-10-08 07:00:52.793
fa9b9ab9-e6d4-4344-9385-c525b457e83b	2ca3a8e3-fa44-42af-9455-679707a2c984	SGST Payable	LIABILITY	L-102	t	2026-10-08 07:00:52.793
6ff66114-d991-4983-8678-bdfce2e7f977	2ca3a8e3-fa44-42af-9455-679707a2c984	IGST Payable	LIABILITY	L-103	t	2026-10-08 07:00:52.793
36bb944b-62c4-480d-9426-ef5ac8eba72d	2ca3a8e3-fa44-42af-9455-679707a2c984	Sales Revenue	INCOME	I-201	t	2026-10-08 07:00:52.793
ee42b081-141b-4585-a250-6ac41854582c	2ca3a8e3-fa44-42af-9455-679707a2c984	Cost of Goods Sold	EXPENSE	E-301	t	2026-10-08 07:00:52.793
f5504c5c-31a1-4705-a451-676049783bc0	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Accounts Receivable	ASSET	SYSTEM_ACCOUNT_RECEIVABLE	t	2026-10-14 12:41:04.496
7e456151-1944-44fc-a847-bd900cfa5ba7	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Sales Revenue	INCOME	SYSTEM_REVENUE	t	2026-10-14 12:41:04.496
888e0d51-c64b-4945-b766-b23ac602c168	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Tax Payable	LIABILITY	SYSTEM_TAX_PAYABLE	t	2026-10-14 12:41:04.496
0d7afd63-18cb-4338-b0fb-e329dfa16785	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Bank	ASSET	SYSTEM_BANK	t	2026-10-14 12:41:04.496
589be011-c270-43e7-b416-5e2296e7a426	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	FX Gain/Loss	EXPENSE	SYSTEM_FX_GAIN_LOSS	t	2026-10-14 12:41:04.496
c2199e29-81d0-4cb0-9780-d90e2c83fcd9	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Cash & Bank	ASSET	SYSTEM_CASH	t	2026-10-14 12:41:20.469
e28b32ae-33c9-479f-a1ca-68bf42720649	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Accounts Receivable	ASSET	SYSTEM_AR	t	2026-10-14 12:41:20.924
def6399f-a8d7-4f45-bc4c-271d0d4fbd54	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Accounts Payable	LIABILITY	SYSTEM_AP	t	2026-10-14 12:41:21.373
fc3c4fad-010b-4fd8-b16d-65c3fe0852ad	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Cost of Goods Sold	EXPENSE	SYSTEM_COGS	t	2026-10-14 12:41:22.05
5f2a9b0b-faa6-4e82-b7f3-5f4c4c859e85	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Sales Returns	INCOME	SYSTEM_SALES_RETURN	t	2026-10-14 12:41:22.505
5fd6d152-7ed8-400d-b737-77229315d455	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Inventory Asset	ASSET	SYSTEM_INVENTORY	t	2026-10-14 12:41:22.959
56d032bb-599d-4d71-8288-ff404f369078	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Customer Advances	LIABILITY	SYSTEM_CUSTOMER_ADVANCE	t	2026-10-14 12:41:23.413
d6b1d58c-7d49-40e6-88f6-0961edbade78	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Employee Loans Receivable	ASSET	SYSTEM_EMPLOYEE_LOAN	t	2026-10-14 12:41:23.864
d5dfa09b-4c6f-4123-866b-c1b6307c3d0c	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Purchase Returns	EXPENSE	SYSTEM_PURCHASE_RETURN	t	2026-10-14 12:41:24.314
34a7242d-02b1-4f28-b3fa-d16b26065a9a	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Salary & Wages	EXPENSE	SYSTEM_SALARY_EXPENSE	t	2026-10-14 12:41:24.766
9c6721c7-bbe9-4fc2-aaf6-cff5dc77702d	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Stock Adjustments	EXPENSE	SYSTEM_STOCK_ADJUSTMENT	t	2026-10-14 12:41:25.217
168d8038-de4f-44e0-b4e4-163d95ef3838	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Tax Receivable	ASSET	SYSTEM_TAX_RECEIVABLE	t	2026-10-14 12:41:25.902
1c2d6d34-7161-491f-8151-aa6bf16bf49d	b76b0c41-78ed-4099-ae0a-f68bed6f1c5d	VAT Payable	LIABILITY	L-101	t	2026-10-15 05:57:35.956
0a74ca75-be84-4eb3-89d6-d01349f820b2	b76b0c41-78ed-4099-ae0a-f68bed6f1c5d	VAT Receivable	ASSET	A-102	t	2026-10-15 05:57:35.956
c45a23d3-fec2-4f50-a5ab-cb0b60fa04b4	b76b0c41-78ed-4099-ae0a-f68bed6f1c5d	Sales Revenue	INCOME	I-201	t	2026-10-15 05:57:35.956
bdbafdf7-4b88-41a9-bef2-2837ce756f8e	b76b0c41-78ed-4099-ae0a-f68bed6f1c5d	Cost of Goods Sold	EXPENSE	E-301	t	2026-10-15 05:57:35.956
\.


--
-- Data for Name: Activity; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Activity" (id, "businessId", type, title, description, "leadId", "dealId", "customerId", "assignedToId", "activityDate", duration, status, "createdAt", "updatedAt", attendees, "contactId", "deletedAt", "dueDate", "isAllDay", "isDeleted", "meetingLink", outcome, priority, "reminderAt") FROM stdin;
ce45a4f4-b037-4765-a03b-b13c803dc427	dc70ca38-b141-477d-a379-f02649117a78	MEETING	testing 	test	\N	\N	2c56aac0-34ea-42fe-951a-64c05675e0a3	\N	2026-09-28 00:00:00	120	Scheduled	2026-09-28 05:25:47.726	2026-09-28 05:25:47.726	null	\N	\N	\N	f	f	\N	\N	\N	\N
6c5acb5e-37b7-4f8b-b9e8-9a7c1e83390e	dc70ca38-b141-477d-a379-f02649117a78	TASK	tes	testtinnn	\N	\N	2c56aac0-34ea-42fe-951a-64c05675e0a3	\N	2026-09-29 00:00:00	130	Scheduled	2026-09-25 13:08:20.279	2026-09-28 11:37:46.666	null	\N	2026-09-28 11:37:46.609	\N	f	t	\N	\N	\N	\N
3d74928e-580f-4f53-8334-db6db9fc7900	dc70ca38-b141-477d-a379-f02649117a78	MEETING	tezt123	test	2b825b82-14a6-4e53-80b5-7d822a3d11d0	\N	\N	\N	2026-10-07 00:00:00	320	Scheduled	2026-10-07 06:12:38.614	2026-10-07 06:14:13.285	null	\N	2026-10-07 06:14:13.222	\N	f	t	\N	\N	\N	\N
471e8a0b-088e-44e8-ab4f-ed1de4d0f68d	dc70ca38-b141-477d-a379-f02649117a78	CALL	tets	test	\N	1de2e805-d02e-423b-acf3-046097d9658d	f2949a27-3ca3-426b-accb-687b093d8831	\N	2026-09-28 00:00:00	3320	Scheduled	2026-09-28 05:27:18.718	2026-10-07 06:14:32.483	null	\N	\N	\N	f	f	\N	\N	\N	\N
\.


--
-- Data for Name: BankChangeRequest; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."BankChangeRequest" (id, "employeeId", "businessId", "bankName", "accountNumber", "accountHolderName", status, "createdAt", "Code", country) FROM stdin;
\.


--
-- Data for Name: Bill; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Bill" (id, "businessId", "billNumber", status, "vendorId", "purchaseOrderId", subtotal, tax, discount, "totalAmount", "billDate", "dueDate", notes, "createdAt", "updatedAt", "grnId", "outstandingAmount", currency, "exchangeRate", "baseCurrencyAmount", "baseCurrencyId", "isLegacyUntracked", "statutoryBaseAmount", "statutoryExchangeRate", "transactionCurrencyId") FROM stdin;
d4dcb4a6-16a4-4fa3-a249-0114efe45b7e	dc70ca38-b141-477d-a379-f02649117a78	BILL-001	UNPAID	25c7ab9e-7119-4b13-baea-17ff392a8bee	e64ee5d4-a3f3-43e8-94b9-1f5bd5e654af	8000	0	0	8000	2026-09-29 10:25:46.059	2026-09-29 10:25:46.059	\N	2026-09-29 10:25:46.061	2026-10-13 07:45:53.267	\N	8000	INR	1	8000	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	\N	\N	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
c9859c9f-b4a1-41ee-8349-3df97a2c71d3	dc70ca38-b141-477d-a379-f02649117a78	BILL-002	PAID	4020a8ee-37c5-46ae-a197-ecca79f50452	032dbe95-507c-4f4f-a08d-2dfc1009932b	80	0	2	78	2026-09-29 10:26:28.741	2026-09-29 10:26:28.741	\N	2026-09-29 10:26:28.744	2026-10-13 07:45:53.491	\N	0	INR	1	78	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	\N	\N	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
b1e497c3-6900-44b8-937c-cd37c5e1f5ec	dc70ca38-b141-477d-a379-f02649117a78	BILL-003	UNPAID	6c691feb-b2e9-49c1-be13-8893b2605594	64444ee1-9add-4b52-8081-7a89f5a240d7	80	0	0	80	2026-09-29 13:27:34.173	2026-09-29 13:27:34.173	\N	2026-09-29 13:27:34.177	2026-10-13 07:45:53.711	\N	0	INR	1	80	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	\N	\N	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
9bb629fd-4919-4100-97e6-786096f2e9c1	dc70ca38-b141-477d-a379-f02649117a78	BILL-004	UNPAID	4020a8ee-37c5-46ae-a197-ecca79f50452	7041205f-a8c0-47d4-9a15-d9b291dc4593	80	0	0	80	2026-10-07 07:21:30.225	2026-10-07 07:21:30.225	\N	2026-10-07 07:21:30.229	2026-10-13 07:45:53.931	\N	0	INR	1	80	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	\N	\N	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
bd214de9-6a63-45f7-8722-5c043bf83075	dc70ca38-b141-477d-a379-f02649117a78	BILL-005	UNPAID	6c691feb-b2e9-49c1-be13-8893b2605594	73303453-3e04-46fb-b360-08c8b3667e4c	8000	400	150	8250	2026-10-07 07:21:35.498	2026-10-07 07:21:35.498	\N	2026-10-07 07:21:35.5	2026-10-13 07:45:54.153	\N	0	INR	1	8250	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	\N	\N	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
\.


--
-- Data for Name: BillItem; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."BillItem" (id, "billId", name, quantity, price, total, "productId", "warehouseId", "taxCategory") FROM stdin;
dfdf31c5-a174-4a43-b9f2-e8c471779898	d4dcb4a6-16a4-4fa3-a249-0114efe45b7e	steel pipe	100	80	8000	45129c19-1372-44d7-9e19-f36db4c68322	7dd52571-d786-4453-9eb2-38f30fcc05cd	\N
eb3a41d7-e1c9-46a4-9df6-aaff9a3f3992	c9859c9f-b4a1-41ee-8349-3df97a2c71d3	testing	1	80	80	45129c19-1372-44d7-9e19-f36db4c68322	7dd52571-d786-4453-9eb2-38f30fcc05cd	\N
46b36cde-c401-4674-a79e-60ffafc56212	b1e497c3-6900-44b8-937c-cd37c5e1f5ec	testing	1	80	80	45129c19-1372-44d7-9e19-f36db4c68322	7dd52571-d786-4453-9eb2-38f30fcc05cd	\N
b6bae9b4-668d-4aae-b904-67dbb637cbf6	9bb629fd-4919-4100-97e6-786096f2e9c1	steel pipe	1	80	80	45129c19-1372-44d7-9e19-f36db4c68322	7dd52571-d786-4453-9eb2-38f30fcc05cd	\N
994fbd6e-2547-4536-a5b1-486c4385c1b2	bd214de9-6a63-45f7-8722-5c043bf83075	testing	100	80	8400	45129c19-1372-44d7-9e19-f36db4c68322	7dd52571-d786-4453-9eb2-38f30fcc05cd	\N
\.


--
-- Data for Name: Campaign; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Campaign" (id, "businessId", name, type, status, budget, "actualCost", "expectedRevenue", "startDate", "endDate", description, "isDeleted", "deletedAt", "createdAt", "updatedAt") FROM stdin;
5227e4cf-521f-43b9-a58c-e3b992d264f8	dc70ca38-b141-477d-a379-f02649117a78	summer special 	PPC	COMPLETED	500000	2500	250	2026-10-08 00:00:00	2026-10-20 00:00:00	testt 	f	\N	2026-10-07 06:17:51.468	2026-10-07 06:17:51.468
\.


--
-- Data for Name: Contract; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Contract" (id, "businessId", "customerId", title, description, value, currency, "startDate", "endDate", "isDeleted", "isHidden", status, "createdAt", "updatedAt", "typeId") FROM stdin;
\.


--
-- Data for Name: ContractType; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ContractType" (id, name, "businessId", "createdAt") FROM stdin;
\.


--
-- Data for Name: CreditNote; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."CreditNote" (id, "businessId", "customerId", "invoiceId", "creditNumber", amount, "remainingAmount", reason, status, "createdAt", "updatedAt", "pdfUrl", type, "vendorId", "deletedAt", "isDeleted", "salesReturnId", currency, "exchangeRate", "baseCurrencyAmount", "baseCurrencyId", "isLegacyUntracked", "statutoryBaseAmount", "statutoryExchangeRate", "transactionCurrencyId") FROM stdin;
920c7596-0a68-48d3-8c16-8c014bfafde7	dc70ca38-b141-477d-a379-f02649117a78	2c56aac0-34ea-42fe-951a-64c05675e0a3	7b31f606-bbe9-4618-8a62-887ffcab2d0a	CN-001	45	45	Overpayment for invoice INV-002	OPEN	2026-09-25 10:27:29.043	2026-09-25 10:27:29.043	\N	INVOICE	\N	\N	f	\N	INR	1	45	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	45	1	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
1981e9b4-db97-45bb-85e0-b37e37d6a184	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	9eb843a1-1966-442e-b84f-8f9245f793af	364a87cb-ece1-4577-baf5-6e885864e2a8	CN-001	590	590	\N	OPEN	2026-10-14 12:41:31.389	2026-10-14 12:41:31.389	\N	INVOICE	\N	\N	f	\N	INR	1	590	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574	f	590	1	dcadb3cb-5ed3-4c4a-a33a-7a92d49db574
\.


--
-- Data for Name: CrmTask; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."CrmTask" (id, "businessId", title, description, status, priority, "dueDate", "reminderAt", "leadId", "dealId", "customerId", "contactId", "assignedToId", "createdById", "isDeleted", "deletedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CustomerContact; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."CustomerContact" (id, "customerId", "businessId", "fullName", email, "position", phone, "isActive", "createdAt", "updatedAt", "contactOwnerId", "deletedAt", "isDeleted", "isPrimary", tags) FROM stdin;
3a136aa6-d800-44ed-a52a-ca13e9fa1d8f	1ee5b577-5c78-47b6-b74c-5f9c9a0a68c0	1f80e27b-bd3f-4cc5-9429-e3758f355d82	John	John@gmail.com	Manager	9908765432	t	2026-07-02 10:11:43.753	2026-07-02 10:11:43.753	\N	\N	f	t	\N
38fa4ce1-113d-468a-9c9c-90dc718e3527	f2949a27-3ca3-426b-accb-687b093d8831	dc70ca38-b141-477d-a379-f02649117a78	Sajid Rangrej	rngrjsjd@gmail.com	Manager 	+916353000671	t	2026-09-16 06:04:42.383	2026-09-16 06:04:42.383	\N	\N	f	t	\N
2d0592da-f4d1-485f-9d4b-89c0361e1b1f	77f9bea7-ebf9-4236-94fc-9aeb5aa1904c	dc70ca38-b141-477d-a379-f02649117a78	Sajid Rangrej	rngrjsjd@gmail.com	Manager 	+916353000671	t	2026-10-07 05:47:09.311	2026-10-07 05:47:09.311	\N	\N	f	f	{}
5c7bfc9e-6abb-47aa-ae7a-356e3efab1a0	77f9bea7-ebf9-4236-94fc-9aeb5aa1904c	dc70ca38-b141-477d-a379-f02649117a78	mukesh	mukesh@gmail.com	Manager 	+91 7894512121	f	2026-10-07 05:34:40.402	2026-10-07 05:49:41.315	\N	2026-10-07 05:49:41.253	t	t	\N
b3cf6a48-8ee8-4c3c-87b9-0ad0475d569b	f2949a27-3ca3-426b-accb-687b093d8831	dc70ca38-b141-477d-a379-f02649117a78	jack	jack@gmail.com	Manager 	796784786	t	2026-10-07 05:50:41.547	2026-10-07 05:50:41.547	\N	\N	f	f	{}
\.


--
-- Data for Name: Deal; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Deal" (id, "businessId", name, amount, currency, "customerId", "contactId", stage, probability, "expectedCloseDate", source, description, "createdAt", "updatedAt", "assignedToId", "campaignId", "deletedAt", "isDeleted", "lostReason", status) FROM stdin;
18c119d5-1b8a-4d14-8f49-d8447e812a18	1f80e27b-bd3f-4cc5-9429-e3758f355d82	Que - Initial Deal	10000	INR	1ee5b577-5c78-47b6-b74c-5f9c9a0a68c0	3a136aa6-d800-44ed-a52a-ca13e9fa1d8f	1	10	2026-08-01 00:00:00	WEBSITE	\N	2026-07-02 10:11:43.769	2026-07-02 10:11:43.769	f83de015-ba3f-4dc7-bb3a-e015d39f564b	\N	\N	f	\N	OPEN
367e8c78-3c97-4d34-b8c5-b95792018ca5	1f80e27b-bd3f-4cc5-9429-e3758f355d82	John	10000	INR	1ee5b577-5c78-47b6-b74c-5f9c9a0a68c0	3a136aa6-d800-44ed-a52a-ca13e9fa1d8f	Negotiation	60	2026-07-24 00:00:00	Website	Deal is in Negotiation	2026-07-02 10:15:15.954	2026-07-02 10:15:15.954	f83de015-ba3f-4dc7-bb3a-e015d39f564b	\N	\N	f	\N	OPEN
e9fa0ae3-4e0c-4c21-8dfb-933dc5eba0d4	1f80e27b-bd3f-4cc5-9429-e3758f355d82	John	100000	INR	fd34c742-91b2-4644-a2c4-66f13f84eeb9	\N	New	30	2026-07-17 00:00:00	Website	New Deal	2026-07-02 10:16:47.535	2026-07-02 10:16:47.535	f83de015-ba3f-4dc7-bb3a-e015d39f564b	\N	\N	f	\N	OPEN
c5ccae9b-f4e0-4737-958c-79ecea1d8020	dc70ca38-b141-477d-a379-f02649117a78	xyz - Initial Deal	18000	CAD	f2949a27-3ca3-426b-accb-687b093d8831	38fa4ce1-113d-468a-9c9c-90dc718e3527	Proposal	34	2026-09-26 00:00:00	REFERRAL	\N	2026-09-16 06:04:42.446	2026-09-16 06:06:18.253	f4c6c91d-0c9c-49c2-9897-635be0f89065	\N	\N	f	\N	OPEN
77d53dfe-6971-4ed8-a46f-ca235b3e53c6	dc70ca38-b141-477d-a379-f02649117a78	test	250000	CAD	f2949a27-3ca3-426b-accb-687b093d8831	38fa4ce1-113d-468a-9c9c-90dc718e3527	Won	50	2026-09-17 00:00:00	Google Ads	Testing	2026-09-17 10:04:40.982	2026-09-17 10:34:09.392	920b85d4-b3c1-476f-a58a-af751af17d28	\N	\N	f	\N	WON
1de2e805-d02e-423b-acf3-046097d9658d	dc70ca38-b141-477d-a379-f02649117a78	ims  - Initial Deal	250000	INR	77f9bea7-ebf9-4236-94fc-9aeb5aa1904c	5c7bfc9e-6abb-47aa-ae7a-356e3efab1a0	New	10	2026-11-06 00:00:00	WEBSITE	\N	2026-10-07 05:34:40.465	2026-10-07 05:45:00.088	8814fd2e-1257-40bc-991f-5a8ff68abb0c	\N	\N	f	\N	OPEN
45487c43-40ff-4fef-a214-6aaf22b67922	dc70ca38-b141-477d-a379-f02649117a78	que info tech - Initial Deal	95000	INR	2c56aac0-34ea-42fe-951a-64c05675e0a3	38fa4ce1-113d-468a-9c9c-90dc718e3527	Won	10	2026-10-24 00:00:00	WEBSITE	test	2026-09-24 05:13:03.451	2026-09-24 05:50:20.551	\N	\N	\N	f	\N	WON
\.


--
-- Data for Name: DealStageHistory; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DealStageHistory" (id, "dealId", "fromStage", "toStage", "changedById", "changedAt") FROM stdin;
f3e7e070-292b-4c06-9b06-583272dbee95	18c119d5-1b8a-4d14-8f49-d8447e812a18	None	1	f83de015-ba3f-4dc7-bb3a-e015d39f564b	2026-07-02 10:11:43.807
0471b5e2-bdae-4b15-92ee-7db341ba4302	367e8c78-3c97-4d34-b8c5-b95792018ca5	None	Negotiation	156f8af2-2f10-43f3-bd39-70a45023153a	2026-07-02 10:15:15.991
802868f6-7279-4ded-9bb3-ea2ac2b2db81	e9fa0ae3-4e0c-4c21-8dfb-933dc5eba0d4	None	New	156f8af2-2f10-43f3-bd39-70a45023153a	2026-07-02 10:16:47.556
559a8990-5aa0-4e87-ad37-f78cc33e91d3	c5ccae9b-f4e0-4737-958c-79ecea1d8020	None	New	f4c6c91d-0c9c-49c2-9897-635be0f89065	2026-09-16 06:04:42.516
d26f9c0f-996a-4814-acb2-e2eefeb9030f	c5ccae9b-f4e0-4737-958c-79ecea1d8020	New	Proposal	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-16 06:06:18.709
97d1b61b-1b3e-4c25-a0d5-0a1a2fc93a68	77d53dfe-6971-4ed8-a46f-ca235b3e53c6	None	Proposal	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-17 10:04:41.437
9a7dc2c8-f47e-406b-9d33-007975bc27bf	77d53dfe-6971-4ed8-a46f-ca235b3e53c6	Proposal	Negotiation	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-17 10:08:07.586
f8a39076-78aa-46b4-b441-9186006d9e1d	77d53dfe-6971-4ed8-a46f-ca235b3e53c6	Negotiation	Won	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-17 10:34:09.84
1091504d-4acb-4f61-af4d-ff8867ba5a68	45487c43-40ff-4fef-a214-6aaf22b67922	None	New	a34d4600-ab65-45ff-845f-a79d1753a031	2026-09-24 05:13:03.519
24c157f1-c21b-40e4-9de8-840d55bc1972	45487c43-40ff-4fef-a214-6aaf22b67922	New	Contacted	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-24 05:18:20.816
20a82da6-2bc4-4bbd-9539-27fbd24abd3d	45487c43-40ff-4fef-a214-6aaf22b67922	Contacted	Won	9ea883d5-0b8c-4d1b-b005-7dc8c29b6615	2026-09-24 05:50:21.064
7da473e7-5c9f-40f6-84e5-7f1843143e51	1de2e805-d02e-423b-acf3-046097d9658d	None	New	\N	2026-10-07 05:34:40.53
\.


--
-- Data for Name: DebitNote; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DebitNote" (id, "businessId", "vendorId", "billId", "purchaseReturnId", "debitNumber", amount, "remainingAmount", reason, status, date, currency, "transactionCurrencyId", "baseCurrencyId", "exchangeRate", "baseCurrencyAmount", "statutoryExchangeRate", "statutoryBaseAmount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DebitNoteItem; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DebitNoteItem" (id, "debitNoteId", "productId", "itemName", description, quantity, rate, "itemType", unit, "taxPercent") FROM stdin;
\.


--
-- Data for Name: DeliveryNote; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DeliveryNote" (id, "businessId", "customerId", "salesOrderId", "deliveryNumber", status, date, "taxPointTrigger", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DeliveryNoteItem; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DeliveryNoteItem" (id, "deliveryNoteId", "productId", "warehouseId", "itemName", quantity, unit) FROM stdin;
\.


--
-- Data for Name: DocumentAuditLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."DocumentAuditLog" (id, "businessId", "documentId", action, "performedBy", comments, "createdAt") FROM stdin;
\.


--
-- Data for Name: EmailLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."EmailLog" (id, "businessId", subject, body, "fromEmail", "toEmail", status, "sentAt", "leadId", "dealId", "customerId", "contactId", attachments, "createdAt") FROM stdin;
d11bf436-67d1-4cbf-bf41-f613b2c9b126	dc70ca38-b141-477d-a379-f02649117a78	testinhgn 	test	sales@deltaledger.com	rngrjsjd@gmail.com	SENT	2026-09-17 11:12:07.134	\N	\N	\N	\N	\N	2026-09-17 11:12:07.134
90f4bb99-16b5-4346-bdd2-77ec9023c3dd	dc70ca38-b141-477d-a379-f02649117a78	testing	demoo 	sales@deltaledger.com	rngrjsjd@gmail.com	SENT	2026-10-07 07:11:49.221	\N	\N	\N	\N	\N	2026-10-07 07:11:49.221
\.


--
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Employee" (id, "businessId", name, email, phone, designation, "joinDate", "basicSalary", "createdAt", allowance, deduction, "leaveBalance", "userId", "accountHolderName", "accountNumber", "bankName", "Code") FROM stdin;
011bcb9e-920e-47ff-8117-d0f709adfe03	dc70ca38-b141-477d-a379-f02649117a78	test	test12@gmail.com	+91 7894561230	ac	2026-10-01 00:00:00	2500	2026-09-30 10:25:16.734	[{"name": "cigratte", "amount": 1000}]	[{"name": "isgst", "amount": 250}]	{"LWP": null, "LV_1789984695925": 10}	030906b0-0f31-4744-baf4-34b076e5eafa	\N	\N	\N	\N
\.


--
-- Data for Name: Expense; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Expense" (id, "businessId", title, amount, category, "paymentMethod", date, notes, "vendorId", "createdAt", "approvalComments", "costCenter", department, "employeeId", "financeId", "managerId", "projectId", status, "taskId", "updatedAt", currency, "customerId", "referenceId", "referenceType", "exchangeRate") FROM stdin;
c7490c56-177e-4c6d-b287-baa804f2416d	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	Expense for Project: PRJ-00003	1000	Basic	Cash	2026-08-05 00:00:00	tgfd	bda8cb50-6267-4711-8c86-98ea264917ed	2026-08-05 06:45:35.625	\N	\N	\N	\N	\N	\N	a4a8432a-aab3-4266-8084-4d1e89665200	Draft	\N	2026-08-05 06:45:35.625	CAD	ca726456-5e30-4dc6-aece-fdf1c7fbfb4d	a4a8432a-aab3-4266-8084-4d1e89665200	Project	1
53b4cf7d-4aa8-44b4-aad1-084c30735219	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	Expense for Project: PRJ-00003	100	Basic	Cash	2026-08-07 00:00:00	\N	bda8cb50-6267-4711-8c86-98ea264917ed	2026-08-07 09:30:16.739	\N	\N	\N	\N	\N	\N	a4a8432a-aab3-4266-8084-4d1e89665200	Draft	\N	2026-08-07 09:30:16.739	CAD	ca726456-5e30-4dc6-aece-fdf1c7fbfb4d	a4a8432a-aab3-4266-8084-4d1e89665200	Project	1
818b1f96-5837-4cfd-ba3e-2bdff10e4484	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	Expense for Project: PRJ-00004	120	Basic	Cash	2026-08-07 00:00:00	\N	bda8cb50-6267-4711-8c86-98ea264917ed	2026-08-07 12:14:26.903	\N	\N	\N	\N	\N	\N	2e108db2-cd4b-4548-9dc3-e9caf18495e4	Draft	\N	2026-08-07 12:14:26.903	CAD	b0ce62c2-a739-4c77-9fc4-6616e889f2d9	2e108db2-cd4b-4548-9dc3-e9caf18495e4	Project	1
211e0c2a-5891-415e-a5e9-725f39badacc	cb379108-37e5-4fe9-ba0c-8d699bc16752	Expense for Project: PRJ-001	100	Basic	Cash	2026-08-11 00:00:00	\N	\N	2026-08-11 09:31:42.455	\N	\N	\N	\N	\N	\N	20f85887-6690-4d67-8a13-f18fe75fcd81	Draft	\N	2026-08-11 09:31:42.455	CAD	53e60c38-7be9-4bea-8a07-e2109933b8da	20f85887-6690-4d67-8a13-f18fe75fcd81	Project	1
bca48e00-c004-4703-a56f-c1a3e5cb1710	cb379108-37e5-4fe9-ba0c-8d699bc16752	Expense for Project: PRJ-001	100	Basic	Cash	2026-08-11 00:00:00	\N	\N	2026-08-11 09:47:01.61	\N	\N	\N	\N	\N	\N	20f85887-6690-4d67-8a13-f18fe75fcd81	Draft	\N	2026-08-11 09:47:01.61	CAD	53e60c38-7be9-4bea-8a07-e2109933b8da	20f85887-6690-4d67-8a13-f18fe75fcd81	Project	1
bcd430e7-4f95-4f57-a125-334208a9999e	cb379108-37e5-4fe9-ba0c-8d699bc16752	Expense for Project: PRJ-001	9	Basic	Cash	2026-08-11 00:00:00	\N	\N	2026-08-11 10:00:06.962	\N	\N	\N	\N	\N	\N	20f85887-6690-4d67-8a13-f18fe75fcd81	Draft	\N	2026-08-11 10:00:37.228	CAD	53e60c38-7be9-4bea-8a07-e2109933b8da	20f85887-6690-4d67-8a13-f18fe75fcd81	Project	1
2d60d6b4-5637-411c-b886-b740ea133f34	44c72903-27a2-4951-a223-5e6e411f24c7	Paid to Saad for drawings	2000	Basic	Bank Transfer	2026-05-31 00:00:00	\N	\N	2026-08-11 09:25:48.006	\N	\N	\N	\N	\N	\N	0a04b050-83bc-42e5-8973-e3d9d580c5a7	Draft	\N	2026-08-11 10:01:36.448	CAD	5f8209be-a20d-4ff3-8670-b0d01850fc5f	0a04b050-83bc-42e5-8973-e3d9d580c5a7	Project	1
ebe1b9e7-5ca7-4a7b-ab68-0ab6c997219f	44c72903-27a2-4951-a223-5e6e411f24c7	Expense for Project: PRJ-003	542.5	Basic	Bank Transfer	2026-06-30 00:00:00	\N	\N	2026-08-11 10:11:26.455	\N	\N	\N	\N	\N	\N	0a04b050-83bc-42e5-8973-e3d9d580c5a7	Draft	\N	2026-08-11 10:11:26.455	CAD	5f8209be-a20d-4ff3-8670-b0d01850fc5f	0a04b050-83bc-42e5-8973-e3d9d580c5a7	Project	1
d1c74181-5cf7-4282-b2e6-25e84a98797a	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	Expense for Project: PRJ-007	1200	Basic	Cash	2026-08-17 00:00:00	10 watches gone for repairng	bda8cb50-6267-4711-8c86-98ea264917ed	2026-08-17 05:40:08.59	\N	\N	\N	\N	\N	\N	4f06ee59-121b-4e14-8e74-1cdd0b8ed0a7	Draft	\N	2026-08-17 05:40:08.59	CAD	7d541b0f-a4fb-443a-be9f-e05767a4c40a	4f06ee59-121b-4e14-8e74-1cdd0b8ed0a7	Project	1
06e4aa8d-3ce2-4a8c-acad-33d963c8b880	dc70ca38-b141-477d-a379-f02649117a78	testing	85000	Rent	Cash	2026-09-21 00:00:00	testing	6c691feb-b2e9-49c1-be13-8893b2605594	2026-09-21 09:44:04.642	\N	\N	\N	\N	\N	\N	\N	Draft	\N	2026-09-21 09:44:04.642	INR	\N	\N	\N	1
\.


--
-- Data for Name: ExpenseAuditLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ExpenseAuditLog" (id, "businessId", "expenseId", action, "performedBy", comments, "createdAt") FROM stdin;
\.


--
-- Data for Name: ExpenseItem; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ExpenseItem" (id, "expenseId", "itemName", description, quantity, rate, "taxPercent", "taxAmount", amount, category, "createdAt", "updatedAt") FROM stdin;
5f0cdbe8-af32-4e06-ac90-2f0985506f19	c7490c56-177e-4c6d-b287-baa804f2416d	Lenovo 10	Lenovo 10 laptop with Intel Core Version 11	1	1000	0	0	1000	\N	2026-08-05 06:45:35.625	2026-08-05 06:45:35.625
2d016aba-8b8e-4039-83ee-d65f54bbc152	53b4cf7d-4aa8-44b4-aad1-084c30735219	Lenovo 10	Lenovo 10 laptop with Intel Core Version 11	1	100	0	0	100	\N	2026-08-07 09:30:16.739	2026-08-07 09:30:16.739
ab95bd3a-dbd6-4b6b-b98e-9f3db198eb7d	818b1f96-5837-4cfd-ba3e-2bdff10e4484	Charger	Laptop Charger	1	120	0	0	120	\N	2026-08-07 12:14:26.903	2026-08-07 12:14:26.903
ed9668a9-41f2-4e31-b137-de71f9517395	bca48e00-c004-4703-a56f-c1a3e5cb1710	pipe	Steel Pipe	1	100	0	0	100	\N	2026-08-11 09:47:01.61	2026-08-11 09:47:01.61
287b7e1e-fc0f-4821-837d-4e4c96219b14	bcd430e7-4f95-4f57-a125-334208a9999e	pipe	Steel Pipe	1	9	0	0	9	\N	2026-08-11 10:00:37.228	2026-08-11 10:00:37.228
046d3af7-2213-4a84-b8b9-d3037c519960	ebe1b9e7-5ca7-4a7b-ab68-0ab6c997219f	Drawings		1	3000	0	0	3000	\N	2026-08-11 10:11:26.455	2026-08-11 10:11:26.455
5ae37b86-1f49-4538-8e82-0c367bfc4a1a	d1c74181-5cf7-4282-b2e6-25e84a98797a	Delton Watch Series 5	Delton Watch series 5 with Modern Dail and Design	10	120	0	0	1200	\N	2026-08-17 05:40:08.59	2026-08-17 05:40:08.59
\.


--
-- Data for Name: InvoiceAuditLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."InvoiceAuditLog" (id, "businessId", "invoiceId", action, "performedBy", comments, "createdAt") FROM stdin;
\.


--
-- Data for Name: JournalEntry; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."JournalEntry" (id, "businessId", "accountId", debit, credit, description, date, "createdAt", "updatedAt", currency, "exchangeRate", "baseCredit", "baseDebit", "isLegacyUntracked", "statutoryCredit", "statutoryDebit", "statutoryRate") FROM stdin;
e0d38de4-4586-4cac-a04e-d370e0e7343f	dc70ca38-b141-477d-a379-f02649117a78	51c75bae-af92-46c1-bb23-f92a6ea4eaef	85000	0	Direct Expense: testing	2026-09-21 09:44:06.726	2026-09-21 09:44:06.728	2026-09-21 09:44:06.728	AED	1	0	85000	f	\N	\N	\N
e53678b5-621e-4ac7-aada-81e890317b63	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	85000	Payment for Direct Expense: testing	2026-09-21 09:44:06.726	2026-09-21 09:44:06.728	2026-09-21 09:44:06.728	AED	1	85000	0	f	\N	\N	\N
54f72e92-8dcb-4e87-8185-64105d7789e1	dc70ca38-b141-477d-a379-f02649117a78	257b51b0-35f8-4255-9561-e4626935389c	52000	0	Payroll Expense for sajid (9/2026)	2026-09-21 10:25:00.359	2026-09-21 10:25:00.361	2026-09-21 10:25:00.361	AED	1	0	52000	f	\N	\N	\N
8a843a91-94e7-4d5e-aadb-e06cdd0e066a	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	52000	Net Salary & Deductions for sajid	2026-09-21 10:25:00.359	2026-09-21 10:25:00.361	2026-09-21 10:25:00.361	AED	1	52000	0	f	\N	\N	\N
8fd15222-4426-490e-a91b-444fa5c63d25	dc70ca38-b141-477d-a379-f02649117a78	a538f7c0-2eaf-4824-ba96-f7eaeb2eec15	2000	0	Loan Disbursed to sajid	2026-09-21 10:27:50.052	2026-09-21 10:27:50.054	2026-09-21 10:27:50.054	AED	1	0	2000	f	\N	\N	\N
8ed62468-ae89-4d70-945c-217c10634dc6	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	2000	Loan Disbursed to sajid	2026-09-21 10:27:50.052	2026-09-21 10:27:50.054	2026-09-21 10:27:50.054	AED	1	2000	0	f	\N	\N	\N
73643772-4763-4ea9-9e25-105b5dcdbe28	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	78	Vendor Payment VPAY-004 for Bill BILL-002	2026-09-29 13:14:49.928	2026-09-29 13:14:49.946	2026-09-29 13:14:49.946	AED	1	78	0	f	\N	\N	\N
1379b862-da69-4d56-a344-e601ddd95cff	dc70ca38-b141-477d-a379-f02649117a78	be98c58f-b553-40be-aaa4-5dc6dda88bf0	78	0	Payment Applied VPAY-004 for Bill BILL-002	2026-09-29 13:14:49.928	2026-09-29 13:14:49.946	2026-09-29 13:14:49.946	AED	1	0	78	f	\N	\N	\N
beffb0ce-6b47-44cb-8f9a-0063c84f86bc	dc70ca38-b141-477d-a379-f02649117a78	2f6320c4-73af-42d0-88ef-43f0c12cc6d0	1000	0	Stock Adjustment ADJ-001 (Add)	2026-09-30 06:55:25.833	2026-09-30 06:55:25.838	2026-09-30 06:55:25.838	AED	1	0	1000	f	\N	\N	\N
2843e9ee-2b1f-4b9c-97e7-4558149fed61	dc70ca38-b141-477d-a379-f02649117a78	72573bbb-5183-4557-8cb6-5a6db501af14	0	1000	Stock Adjustment ADJ-001 (Add)	2026-09-30 06:55:25.833	2026-09-30 06:55:25.838	2026-09-30 06:55:25.838	AED	1	1000	0	f	\N	\N	\N
29f556d1-0279-4b0d-b470-ac610e0be710	dc70ca38-b141-477d-a379-f02649117a78	be98c58f-b553-40be-aaa4-5dc6dda88bf0	2000	0	test	2026-09-30 00:00:00	2026-09-30 10:01:31.964	2026-09-30 10:01:31.964	AED	\N	\N	\N	f	\N	\N	\N
5cc80b7e-8045-45ae-9815-3d6a78fa865a	dc70ca38-b141-477d-a379-f02649117a78	51c75bae-af92-46c1-bb23-f92a6ea4eaef	50004	0	Direct Expense: test	2026-09-30 10:06:20.785	2026-09-30 10:06:20.788	2026-09-30 10:06:20.788	AED	1	0	50004	f	\N	\N	\N
ad452074-0dd9-45c2-af03-d52419042ec7	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	50004	Payment for Direct Expense: test	2026-09-30 10:06:20.785	2026-09-30 10:06:20.788	2026-09-30 10:06:20.788	AED	1	50004	0	f	\N	\N	\N
f81362d0-69a2-45fd-9599-6d75b0e241c0	dc70ca38-b141-477d-a379-f02649117a78	257b51b0-35f8-4255-9561-e4626935389c	26000	0	Payroll Expense for test (10/2026)	2026-09-30 10:49:52.256	2026-09-30 10:49:52.261	2026-09-30 10:49:52.261	AED	1	0	26000	f	\N	\N	\N
9b923f5f-65fd-417a-a3d5-045931509e53	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	26000	Net Salary & Deductions for test	2026-09-30 10:49:52.256	2026-09-30 10:49:52.261	2026-09-30 10:49:52.261	AED	1	26000	0	f	\N	\N	\N
3842de7b-cff6-429e-90c4-caa65d274b18	dc70ca38-b141-477d-a379-f02649117a78	257b51b0-35f8-4255-9561-e4626935389c	62000	0	Payroll Expense for sajid (10/2026)	2026-09-30 10:49:52.32	2026-09-30 10:49:52.328	2026-09-30 10:49:52.328	AED	1	0	62000	f	\N	\N	\N
027fac14-2b4b-42e1-a955-af4a0ef713ab	dc70ca38-b141-477d-a379-f02649117a78	a538f7c0-2eaf-4824-ba96-f7eaeb2eec15	0	500	Loan Deduction for sajid	2026-09-30 10:49:52.32	2026-09-30 10:49:52.328	2026-09-30 10:49:52.328	AED	1	500	0	f	\N	\N	\N
168c1f4e-8a0b-455b-91dc-16d1deaa75f4	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	0	61500	Net Salary & Deductions for sajid	2026-09-30 10:49:52.32	2026-09-30 10:49:52.328	2026-09-30 10:49:52.328	AED	1	61500	0	f	\N	\N	\N
a77714ac-5d8d-4186-ba6b-fc3c9990d489	dc70ca38-b141-477d-a379-f02649117a78	ab146364-df05-4455-a6a2-5233ced6ccf5	945	0	Sales Invoice #INV-002	2026-09-25 10:00:42.524	2026-10-14 07:41:15.189	2026-10-14 07:41:15.189	INR	1	0	945	f	\N	\N	\N
0169074f-c643-47b5-a1d9-512b87a8a335	dc70ca38-b141-477d-a379-f02649117a78	aaaf6c1a-f3d9-4437-8ca0-219a9851a83d	0	900	Revenue for Invoice #INV-002	2026-09-25 10:00:42.524	2026-10-14 07:41:15.189	2026-10-14 07:41:15.189	INR	1	900	0	f	\N	\N	\N
f3bf32f8-0b9f-40cc-bb7c-263efb31067d	dc70ca38-b141-477d-a379-f02649117a78	3d4398f7-6b11-4761-8147-3f2117ebdaff	0	45	Output Tax for Invoice #INV-002	2026-09-25 10:00:42.524	2026-10-14 07:41:15.189	2026-10-14 07:41:15.189	INR	1	45	0	f	\N	\N	\N
d3ec39cb-5288-4ec9-a23f-baf68e3b6828	dc70ca38-b141-477d-a379-f02649117a78	7838c0be-8c45-487c-8f46-ede477b3f29f	677.5	0	Advance Applied PAY-002 for Invoice #INV-002	2026-09-25 00:00:00	2026-10-14 07:41:16.068	2026-10-14 07:41:16.068	INR	1	0	677.5	f	\N	\N	\N
0db77314-00b0-479f-bab0-5555eec7dd1d	dc70ca38-b141-477d-a379-f02649117a78	ab146364-df05-4455-a6a2-5233ced6ccf5	0	677.5	Payment Applied PAY-002 for Invoice #INV-002	2026-09-25 00:00:00	2026-10-14 07:41:16.068	2026-10-14 07:41:16.068	INR	1	677.5	0	f	\N	\N	\N
79af356f-9010-4cf2-98c2-472454d6f14d	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	e28b32ae-33c9-479f-a1ca-68bf42720649	5900	0	Invoice #INV-001	2026-10-14 12:41:26.355	2026-10-14 12:41:26.359	2026-10-14 12:41:26.359	AED	1	0	5900	f	\N	\N	\N
5076e8f0-a619-41c3-8919-0c3663e44b4f	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	7e456151-1944-44fc-a847-bd900cfa5ba7	0	5000	Invoice #INV-001 (Net Revenue)	2026-10-14 12:41:26.355	2026-10-14 12:41:26.359	2026-10-14 12:41:26.359	AED	1	5000	0	f	\N	\N	\N
20174671-107e-419c-9e74-abf7c7290027	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	888e0d51-c64b-4945-b766-b23ac602c168	0	900	Invoice #INV-001 (Tax)	2026-10-14 12:41:26.355	2026-10-14 12:41:26.359	2026-10-14 12:41:26.359	AED	1	900	0	f	\N	\N	\N
887f935b-af72-4f07-9bea-d829bb63a576	dc70ca38-b141-477d-a379-f02649117a78	699392c9-f8ee-40aa-bc8d-bc6cd4ac9ffa	267.5	0	Payment Received PAY-003 for Invoice #INV-002	2026-09-25 10:13:50.958	2026-09-25 10:13:50.962	2026-10-15 06:02:57.963	INR	1	0	267.5	f	\N	\N	\N
94450136-eb56-4133-a524-82a01215a098	dc70ca38-b141-477d-a379-f02649117a78	ab146364-df05-4455-a6a2-5233ced6ccf5	0	267.5	Payment Applied PAY-003 for Invoice #INV-002	2026-09-25 10:13:50.958	2026-09-25 10:13:50.962	2026-10-15 06:02:58.18	INR	1	267.5	0	f	\N	\N	\N
c1b77303-040b-488d-8384-c948b529c9ce	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	7e456151-1944-44fc-a847-bd900cfa5ba7	500	0	Credit Note #CN-001 (Net Revenue Reversal)	2026-10-14 12:41:35.236	2026-10-14 12:41:35.24	2026-10-14 12:41:35.24	AED	1	0	500	f	\N	\N	\N
5ff58558-3253-43a8-92d2-6b22c3be26b4	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	e28b32ae-33c9-479f-a1ca-68bf42720649	0	590	Credit Note #CN-001	2026-10-14 12:41:35.236	2026-10-14 12:41:35.24	2026-10-14 12:41:35.24	AED	1	590	0	f	\N	\N	\N
2099f118-cd44-4862-b3f0-e81cff707887	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	888e0d51-c64b-4945-b766-b23ac602c168	90	0	Credit Note #CN-001 (Tax Reversal)	2026-10-14 12:41:35.236	2026-10-14 12:41:35.24	2026-10-14 12:41:35.24	AED	1	0	90	f	\N	\N	\N
\.


--
-- Data for Name: Lead; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Lead" (id, name, "position", email, phone, company, website, city, state, country, "zipCode", "leadValue", description, "isPublic", "contactedToday", "defaultLanguage", "createdAt", "updatedAt", status, source, "stageId", "businessId", tags, "assignedToId", "campaignId", "deletedAt", "isDeleted", score, "budgetRange", "businessRequirement", "businessUnit", "companySize", "competitorName", competitors, currency, "currentBusinessProblem", deliverables, department, "estimatedTeamSize", "executionType", "expectedCompletionDate", "expectedDecisionDate", "expectedDuration", "expectedMargin", "expectedProfit", "expectedRevenue", "expectedSolution", "expectedStartDate", "followUpNotes", "gstVatNumber", industry, "inquiryNumber", "inquiryTitle", "inquiryType", "internalNotes", "managementNotes", "meetingDate", "meetingLocation", "meetingType", "nextFollowUpDate", "preferredCommunication", priority, probability, "projectType", reminder, "riskLevel", "salesStrategy", "scopeSummary", timezone, "winProbability", "customerId", "requirementId") FROM stdin;
cae6a40b-4e05-4968-8665-ddba245b4b2d	John	Manager	John@gmail.com	9908765432	Que	https://que.in	Ahmedabad	Gujrat	India	38001	10000	Contacted Lead	t	t	English	2026-07-02 10:09:21.81	2026-07-02 10:11:43.832	CONVERTED	WEBSITE	\N	1f80e27b-bd3f-4cc5-9429-e3758f355d82	{Imp}	f83de015-ba3f-4dc7-bb3a-e015d39f564b	\N	\N	f	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
0258da0a-8d7e-490e-848f-d8715d6ce415	John	Manager	dell@gmail.com	9908765432	Test	https://test.in	Ahmedabad	Gujrat	India	380001	20000	Converted	t	f	English	2026-07-02 10:18:18.552	2026-07-02 10:18:18.552	CONVERTED	SOCIAL_MEDIA	\N	1f80e27b-bd3f-4cc5-9429-e3758f355d82	{New}	f83de015-ba3f-4dc7-bb3a-e015d39f564b	\N	\N	f	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
add0df58-2721-447c-ac9b-0876b8d51732	Sajid Rangrej	Manager 	rngrjsjd@gmail.com	+916353000671	xyz	queinfotech.com	Ahmedabad	Gujarat	India	380028	20000	testing 	t	f	English	2026-09-16 05:53:28.851	2026-09-16 06:04:42.582	CONVERTED	REFERRAL	\N	dc70ca38-b141-477d-a379-f02649117a78	{Vip}	f4c6c91d-0c9c-49c2-9897-635be0f89065	\N	\N	f	0	\N	\N	\N	\N	\N	\N	INR	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
b87ce8df-af0f-4f74-b736-28da0775f799	test	Manager 	test@gmail.com	7894561230	abc	queinfotech.com	Ahmedabad	Gujarat	India	380028	222	testing \n	t	f	English	2026-09-17 09:52:58.858	2026-09-17 09:58:15.082	CONTACTED	WEBSITE	\N	dc70ca38-b141-477d-a379-f02649117a78	{Vip}	920b85d4-b3c1-476f-a58a-af751af17d28	\N	2026-09-17 09:58:15.024	t	0	\N	\N	\N	\N	\N	\N	INR	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
f4fc0caa-f78f-4025-842b-be726479b332	que info tech	CEO	xya@gmail.com	6353000671	que info tech		Ahmedabad	Gujarat	India		0	\N	f	f	SYSTEM	2026-09-30 12:52:40.261	2026-09-30 12:52:40.261	NEW	EMAIL	\N	dc70ca38-b141-477d-a379-f02649117a78	{}	8814fd2e-1257-40bc-991f-5a8ff68abb0c	\N	\N	f	0		ydvshbhbs		11-50			\N				\N	AUTO_DETECT	\N	\N		\N	\N	\N		\N		98765432123456789	Healthcare	INQ-001	ERp				\N			\N		LOW	\N	Healthcare	f				IST (UTC+05:30)	\N	2c56aac0-34ea-42fe-951a-64c05675e0a3	\N
36aeb236-ef0c-4128-9aaa-24ea5ea5eb94	Sajid Rangrej	Manager 	rngrjsjd@gmail.com	+91 6353000671	xya	queinfotech.com	Ahmedabad	Gujarat	India	380028	0	testing 	t	f	English	2026-09-21 13:18:46.717	2026-09-21 13:21:08.073	CONVERTED	WEBSITE	\N	dc70ca38-b141-477d-a379-f02649117a78	{Vip}	\N	\N	2026-09-21 13:21:08.014	t	0	\N	\N	\N	\N	\N	\N	INR	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
0ee0f948-5a9c-4583-a4c9-f9a1ce270b4b	Sajid Rangrej	Manager 	rngrjsjd@gmail.com	+91 6353000671	que info tech	queinfotech.com	Ahmedabad	Gujarat	India	380028	952000	test	t	f	English	2026-09-24 05:08:37.767	2026-09-24 05:13:03.592	CONVERTED	WEBSITE	\N	dc70ca38-b141-477d-a379-f02649117a78	{Vip}	\N	\N	\N	f	0	\N	\N	\N	\N	\N	\N	INR	\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
8ed87a63-2b87-4ba0-b598-ac2ede86262d	que info tech	manager nnn	test@gmail.com	+91 6353000671	que info tech	https://xyz	Ahmedabad	Gujarat	Saudi Arabia	380210	0	\N	f	f	SYSTEM	2026-10-01 06:36:35.121	2026-10-01 12:32:11.772	QUALIFIED	EMAIL	\N	dc70ca38-b141-477d-a379-f02649117a78	{vip}	\N	\N	\N	f	0	50000	software 		50		xua	\N	software issue 		sales	\N	AUTO_DETECT	\N	2026-10-02 00:00:00	6	\N	25	25000	test	2026-10-01 00:00:00		0987654345678	Agriculture	INQ-002	test			tegsvgsv	\N	zoon	online 	2026-10-03 00:00:00		LOW	20	Architecture	f	lkjh	oiugfbnj	oihgfghj	AST (UTC+03:00)	\N	2c56aac0-34ea-42fe-951a-64c05675e0a3	30c03753-f9d3-4499-bbc7-8733e3d6cf9b
2b825b82-14a6-4e53-80b5-7d822a3d11d0	mukesh	Manager 	mukesh@gmail.com	+91 7894512121	ims 						0		t	t	English	2026-10-07 05:31:47.094	2026-10-07 05:44:24.466	CONVERTED	WEBSITE	\N	dc70ca38-b141-477d-a379-f02649117a78	{}	\N	\N	\N	f	0	\N	\N	\N	\N	\N	\N		\N	\N	\N	\N	AUTO_DETECT	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MEDIUM	\N	\N	f	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: LeadActivity; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeadActivity" (id, "leadId", message, "createdAt") FROM stdin;
\.


--
-- Data for Name: LeadConversionLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeadConversionLog" (id, "businessId", "leadId", "customerId", "contactId", "dealId", "convertedById", "convertedAt") FROM stdin;
3e2a36e5-16a8-45ac-8a77-1883856255a3	1f80e27b-bd3f-4cc5-9429-e3758f355d82	cae6a40b-4e05-4968-8665-ddba245b4b2d	1ee5b577-5c78-47b6-b74c-5f9c9a0a68c0	3a136aa6-d800-44ed-a52a-ca13e9fa1d8f	18c119d5-1b8a-4d14-8f49-d8447e812a18	f83de015-ba3f-4dc7-bb3a-e015d39f564b	2026-07-02 10:11:43.841
f30ec4b8-cc72-4eee-9211-98cb7a0a79d3	dc70ca38-b141-477d-a379-f02649117a78	add0df58-2721-447c-ac9b-0876b8d51732	f2949a27-3ca3-426b-accb-687b093d8831	38fa4ce1-113d-468a-9c9c-90dc718e3527	c5ccae9b-f4e0-4737-958c-79ecea1d8020	f4c6c91d-0c9c-49c2-9897-635be0f89065	2026-09-16 06:04:42.64
8e857b7f-b9fb-4df9-86f0-d592519a7902	dc70ca38-b141-477d-a379-f02649117a78	2b825b82-14a6-4e53-80b5-7d822a3d11d0	77f9bea7-ebf9-4236-94fc-9aeb5aa1904c	5c7bfc9e-6abb-47aa-ae7a-356e3efab1a0	1de2e805-d02e-423b-acf3-046097d9658d	\N	2026-10-07 05:34:40.656
6b4a472c-1f00-4131-8aba-1f5d0cfccd4b	dc70ca38-b141-477d-a379-f02649117a78	0ee0f948-5a9c-4583-a4c9-f9a1ce270b4b	2c56aac0-34ea-42fe-951a-64c05675e0a3	38fa4ce1-113d-468a-9c9c-90dc718e3527	45487c43-40ff-4fef-a214-6aaf22b67922	\N	2026-09-24 05:13:03.649
\.


--
-- Data for Name: LeadNote; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeadNote" (id, "leadId", note, "createdAt") FROM stdin;
\.


--
-- Data for Name: LeadReminder; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeadReminder" (id, "leadId", title, date) FROM stdin;
28916117-54c8-48b4-b755-089c7bf34f45	f4fc0caa-f78f-4025-842b-be726479b332	tet	2026-09-30 19:24:00
8c7dce61-7f9a-4577-9678-179df12fb3b9	8ed87a63-2b87-4ba0-b598-ac2ede86262d	Review 	2026-10-01 12:07:00
7161de06-8aba-4d9a-8646-d8d1e94b7a93	8ed87a63-2b87-4ba0-b598-ac2ede86262d	Review	2026-10-01 16:10:00
60453515-be0c-44bb-90a5-bc137c8001cb	8ed87a63-2b87-4ba0-b598-ac2ede86262d	test	2026-10-09 11:30:00
\.


--
-- Data for Name: LeadTask; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeadTask" (id, "leadId", title, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Leave; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Leave" (id, "businessId", "employeeId", "leaveCode", date, duration, "createdAt", status) FROM stdin;
1f4f10fb-9d4e-4e6c-b900-bb15eb0673b0	dc70ca38-b141-477d-a379-f02649117a78	011bcb9e-920e-47ff-8117-d0f709adfe03	LWP	2026-10-07 00:00:00	FULL	2026-10-07 13:32:35.042	APPROVED
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Loan" (id, "employeeId", "businessId", "totalAmount", "remainingAmount", "emiAmount", "startDate", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Note; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Note" (id, "businessId", content, "leadId", "dealId", "customerId", "contactId", "createdById", attachments, "isDeleted", "deletedAt", "createdAt", "updatedAt") FROM stdin;
22051aec-da69-4173-8d80-a71265be8032	dc70ca38-b141-477d-a379-f02649117a78	test 	8ed87a63-2b87-4ba0-b598-ac2ede86262d	\N	\N	\N	\N	\N	f	\N	2026-10-06 13:04:30.629	2026-10-06 13:04:30.629
\.


--
-- Data for Name: Overtime; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Overtime" (id, "employeeId", "businessId", "overtimeHours", date, "createdAt") FROM stdin;
\.


--
-- Data for Name: Payroll; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Payroll" (id, "businessId", month, year, status, "createdAt") FROM stdin;
a77fcdfb-c0c7-4792-88b4-d2e29fe2400a	dc70ca38-b141-477d-a379-f02649117a78	9	2026	draft	2026-09-21 10:24:59.21
b7319cab-8c3c-4ff0-9aab-d59ecb6c85ce	dc70ca38-b141-477d-a379-f02649117a78	10	2026	draft	2026-09-30 10:49:51.101
\.


--
-- Data for Name: Payslip; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Payslip" (id, "payrollId", "employeeId", "basicSalary", allowance, deduction, "netSalary", status, "pdfUrl", "createdAt", "employeeName", "overtimePay", "loanDeduction") FROM stdin;
f48eec3c-60aa-4dd7-962b-c31a4eb11ea0	b7319cab-8c3c-4ff0-9aab-d59ecb6c85ce	011bcb9e-920e-47ff-8117-d0f709adfe03	25000	1000	250	25750	pending	\N	2026-09-30 10:49:51.348	test	0	0
\.


--
-- Data for Name: PipelineStage; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."PipelineStage" (id, name, "order", color) FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Product" (id, "businessId", name, description, sku, price, "costPrice", "taxPercent", unit, "isActive", "createdAt", "updatedAt", "taxCode", type, attachments, barcode, "brandId", "categoryId", image, "isBatchTracking", "isSerialTracking", "minimumStock", "openingStock", "reorderLevel", "unitId", "taxCategory") FROM stdin;
198769df-833e-45d6-a260-d3b395a48d91	1f80e27b-bd3f-4cc5-9429-e3758f355d82	Laptop	\N	PRD-912900	200	120	18	pcs	t	2026-07-17 12:38:32.726	2026-07-17 12:38:32.726	7898	GOODS	\N	\N	\N	\N	\N	f	f	0	0	0	\N	\N
40f1656f-8ada-42d1-a802-0277669d8894	44c72903-27a2-4951-a223-5e6e411f24c7	Renovation Tasks	\N	PRD-907544	0	0	0	pcs	t	2026-07-20 13:25:08.253	2026-07-20 13:25:08.253	\N	GOODS	\N	\N	\N	\N	\N	f	f	0	0	0	\N	\N
45129c19-1372-44d7-9e19-f36db4c68322	dc70ca38-b141-477d-a379-f02649117a78	steel pipe	testing	PRD-087347	100	80	0	pcs	t	2026-09-16 06:11:27.214	2026-09-21 06:53:40.419	33235	GOODS	null	8523684	\N	\N		f	f	0	0	2520	\N	\N
7f98dc0c-5652-4318-8fb7-2c8bb99c49dc	dc70ca38-b141-477d-a379-f02649117a78	Shirt 	test	poiuy	2500	2000	2.5	pcs	t	2026-09-30 05:52:44.421	2026-09-30 06:31:33.866	0987	GOODS	null		\N	\N		f	f	0	0	58	\N	\N
f0ccb2dc-d00e-4ee1-8aff-05c69c96c635	e0250f84-1b58-4bf4-ba61-ea93ddaacf45	Test Goods	\N	NEW-IN-1791981655638	1000	500	0	pcs	t	2026-10-14 12:41:03.041	2026-10-14 12:41:03.041	\N	GOODS	\N	\N	\N	\N	\N	f	f	0	0	0	\N	\N
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Project" (id, "businessId", "projectCode", "projectName", "customerId", "projectManagerId", department, "categoryId", "typeId", priority, status, budget, revenue, "expectedProfit", "actualCost", "committedCost", "laborCost", "materialCost", "invoicedRevenue", "collectedRevenue", "estimatedHours", "startDate", "endDate", "completionPercentage", "quotationId", "salesOrderId", "executionType", "billingMethod", "templateId", "createdAt", "updatedAt", note, "exchangeRate") FROM stdin;
828168ab-32c3-478e-8ef4-0a251d1a7f07	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	PRJ-001	Estimate	a9b8f97c-c3b4-4b90-9b88-2e1572a866ec	\N	\N	\N	\N	\N	ACTIVE	100	0	20	0	0	0	0	0	0	0	\N	\N	0	d2d52b48-1c84-40c8-91b6-bff291bc3574	\N	PRODUCT	\N	\N	2026-07-31 06:05:37.308	2026-07-31 06:05:37.308	\N	1
b51d3bdd-0daf-4804-900e-e385978912f6	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	PRJ-00002	Estimate	a9b8f97c-c3b4-4b90-9b88-2e1572a866ec	\N	Construction	\N	\N	\N	ACTIVE	100	0	0	0	0	0	0	0	0	0	2026-08-07 00:00:00	\N	0	d2d52b48-1c84-40c8-91b6-bff291bc3574	\N	CONSTRUCTION	\N	\N	2026-07-31 06:06:06.531	2026-07-31 06:06:06.531	hgfvdcsa	1
d7265912-9f2b-4edb-8873-447fb45c395b	44c72903-27a2-4951-a223-5e6e411f24c7	PRJ-002	Test 2 from same quote	c62bd9e6-dc18-4ddc-a7d6-1e861f76f4c6	\N	Basic	\N	\N	\N	ACTIVE	200	0	0	0	0	0	0	0	0	0	2026-01-15 00:00:00	\N	0	96817878-2337-4679-978c-ca57daedd8d9	\N	BASIC	\N	\N	2026-08-11 09:23:02.931	2026-08-11 09:23:02.931		1
2e108db2-cd4b-4548-9dc3-e9caf18495e4	e24ee048-2039-4c2e-a1c9-24bf7b2f943e	PRJ-00004	Laptop Kit	b0ce62c2-a739-4c77-9fc4-6616e889f2d9	\N	Bas