-- =============================================================================
-- PRODUCT CATALOG MANAGER  |  Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Database:  Microsoft SQL Server 2019+
-- Purpose:   Create all normalized tables, relationships, and constraints
-- =============================================================================

-- NOTE: On Azure SQL, databases are created via the Azure Portal, not via script.
-- Connect SSMS directly to ProductCatalogDB before running this script.
-- The USE statement is not supported on Azure SQL — connect to the target DB instead.

-- =============================================================================
-- TABLE: Categories
-- Purpose:  Lookup / reference table for the 5 product categories.
--           Normalized out of Products so a category can only ever appear once,
--           making rename or audit trivially easy.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Categories]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Categories] (
        [CategoryID]   INT            NOT NULL IDENTITY(1,1),
        [CategoryName] NVARCHAR(100)  NOT NULL,
        [Description]  NVARCHAR(500)  NULL,
        [IsActive]     BIT            NOT NULL DEFAULT 1,
        [CreatedAt]    DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]    DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT [PK_Categories]        PRIMARY KEY CLUSTERED ([CategoryID]),
        CONSTRAINT [UQ_Categories_Name]   UNIQUE ([CategoryName])
    );
END
GO

-- =============================================================================
-- TABLE: Suppliers
-- Purpose:  Normalizes the Supplier text field out of Products.
--           A product can reference one supplier; a supplier can serve many products.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Suppliers]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Suppliers] (
        [SupplierID]    INT            NOT NULL IDENTITY(1,1),
        [SupplierName]  NVARCHAR(100)  NOT NULL,
        [ContactEmail]  NVARCHAR(200)  NULL,
        [ContactPhone]  NVARCHAR(30)   NULL,
        [Address]       NVARCHAR(500)  NULL,
        [Country]       NVARCHAR(100)  NULL,
        [IsActive]      BIT            NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT [PK_Suppliers]       PRIMARY KEY CLUSTERED ([SupplierID]),
        CONSTRAINT [UQ_Suppliers_Name]  UNIQUE ([SupplierName])
    );
END
GO

-- =============================================================================
-- TABLE: Tags
-- Purpose:  Canonical tag registry.  Each unique tag word lives here exactly once.
--           Products reference tags via the ProductTags junction table (many-to-many).
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tags]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Tags] (
        [TagID]   INT           NOT NULL IDENTITY(1,1),
        [TagName] NVARCHAR(50)  NOT NULL,

        CONSTRAINT [PK_Tags]       PRIMARY KEY CLUSTERED ([TagID]),
        CONSTRAINT [UQ_Tags_Name]  UNIQUE ([TagName])
    );
END
GO

-- =============================================================================
-- TABLE: Products  (Core entity)
-- Purpose:  Central product record.  CategoryID and SupplierID are FKs to their
--           respective lookup tables.  Tags are linked via ProductTags.
--           SubCategory remains a free-text field because its values are too
--           diverse and product-specific to justify a separate lookup table at
--           this stage (YAGNI / avoidance of over-normalisation).
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Products] (
        [ProductID]    NVARCHAR(10)   NOT NULL,
        [ProductName]  NVARCHAR(100)  NOT NULL,
        [CategoryID]   INT            NOT NULL,
        [SubCategory]  NVARCHAR(60)   NULL,
        [Description]  NVARCHAR(MAX)  NULL,
        [Price]        DECIMAL(10, 2) NOT NULL,
        [Currency]     NCHAR(3)       NOT NULL DEFAULT N'USD',
        [Stock]        INT            NOT NULL DEFAULT 0,
        [Unit]         NVARCHAR(10)   NOT NULL DEFAULT N'EA',
        [Rating]       DECIMAL(3, 2)  NOT NULL DEFAULT 0.00,
        [RatingCount]  INT            NOT NULL DEFAULT 0,
        [Status]       NVARCHAR(20)   NOT NULL DEFAULT N'Active',
        [SupplierID]   INT            NULL,
        [Featured]     BIT            NOT NULL DEFAULT 0,
        [Discount]     TINYINT        NOT NULL DEFAULT 0,
        [Weight]       NVARCHAR(30)   NULL,
        [Dimensions]   NVARCHAR(60)   NULL,
        [CreatedAt]    DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),
        [ModifiedAt]   DATETIME2(0)   NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT [PK_Products]            PRIMARY KEY CLUSTERED ([ProductID]),
        CONSTRAINT [FK_Products_Category]   FOREIGN KEY ([CategoryID])
            REFERENCES [dbo].[Categories] ([CategoryID]),
        CONSTRAINT [FK_Products_Supplier]   FOREIGN KEY ([SupplierID])
            REFERENCES [dbo].[Suppliers]  ([SupplierID]),

        -- Domain integrity guards
        CONSTRAINT [CK_Products_Price]      CHECK ([Price]    >= 0),
        CONSTRAINT [CK_Products_Stock]      CHECK ([Stock]    >= 0),
        CONSTRAINT [CK_Products_Rating]     CHECK ([Rating]   >= 0  AND [Rating]   <= 5),
        CONSTRAINT [CK_Products_Discount]   CHECK ([Discount] >= 0  AND [Discount] <= 100),
        CONSTRAINT [CK_Products_RateCnt]    CHECK ([RatingCount] >= 0),
        CONSTRAINT [CK_Products_Currency]   CHECK ([Currency] IN (N'USD', N'EUR', N'GBP')),
        CONSTRAINT [CK_Products_Unit]       CHECK ([Unit]     IN (N'EA', N'KG', N'L', N'M')),
        CONSTRAINT [CK_Products_Status]     CHECK ([Status]   IN (N'Active', N'Inactive', N'Discontinued'))
    );
END
GO

-- =============================================================================
-- TABLE: ProductTags  (Junction / bridge table)
-- Purpose:  Resolves the many-to-many relationship between Products and Tags.
--           ON DELETE CASCADE ensures orphan rows are removed when a product
--           is deleted — no manual cleanup required.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ProductTags]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[ProductTags] (
        [ProductID]  NVARCHAR(10)  NOT NULL,
        [TagID]      INT           NOT NULL,

        CONSTRAINT [PK_ProductTags]          PRIMARY KEY ([ProductID], [TagID]),
        CONSTRAINT [FK_ProdTags_Product]     FOREIGN KEY ([ProductID])
            REFERENCES [dbo].[Products] ([ProductID]) ON DELETE CASCADE,
        CONSTRAINT [FK_ProdTags_Tag]         FOREIGN KEY ([TagID])
            REFERENCES [dbo].[Tags]     ([TagID])     ON DELETE CASCADE
    );
END
GO

-- =============================================================================
-- TABLE: ProductIDSequence
-- Purpose:  Single-row counter used to generate deterministic, gap-free
--           ProductIDs in the format P001, P002, … without IDENTITY columns.
--           Updated atomically via UPDATE with UPDLOCK to prevent race conditions
--           under concurrent inserts.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ProductIDSequence]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[ProductIDSequence] (
        [LastNumber]  INT  NOT NULL DEFAULT 0,
        CONSTRAINT [CK_Seq_Single]  CHECK ([LastNumber] >= 0)
    );
    -- Seed the single row
    INSERT INTO [dbo].[ProductIDSequence] ([LastNumber]) VALUES (0);
END
GO

PRINT 'Migration 001 complete: all tables created.';
GO
