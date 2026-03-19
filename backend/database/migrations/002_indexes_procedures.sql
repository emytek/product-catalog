-- =============================================================================
-- PRODUCT CATALOG MANAGER  |  Indexes, Views & Stored Procedures
-- Migration: 002_indexes_procedures.sql
-- Purpose:   Performance indexes, covering indexes, and stored procedures for
--            the most frequent query patterns.
-- =============================================================================

-- NOTE: Connect SSMS directly to ProductCatalogDB before running this script.
-- The USE statement is not supported on Azure SQL.

-- =============================================================================
-- NON-CLUSTERED INDEXES
-- Strategy: index every column that appears in WHERE, ORDER BY, or JOIN clauses.
-- =============================================================================

-- Products: filter by category (most common filter)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_CategoryID')
    CREATE NONCLUSTERED INDEX [IX_Products_CategoryID]
        ON [dbo].[Products] ([CategoryID]);
GO

-- Products: filter by status (Active / Inactive / Discontinued)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_Status')
    CREATE NONCLUSTERED INDEX [IX_Products_Status]
        ON [dbo].[Products] ([Status]);
GO

-- Products: featured flag (homepage carousel)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_Featured')
    CREATE NONCLUSTERED INDEX [IX_Products_Featured]
        ON [dbo].[Products] ([Featured])
        INCLUDE ([ProductID], [ProductName], [Price], [Rating]);
GO

-- Products: price range filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_Price')
    CREATE NONCLUSTERED INDEX [IX_Products_Price]
        ON [dbo].[Products] ([Price]);
GO

-- Products: sort by rating descending (product list default sort)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_Rating_Desc')
    CREATE NONCLUSTERED INDEX [IX_Products_Rating_Desc]
        ON [dbo].[Products] ([Rating] DESC)
        INCLUDE ([ProductID], [ProductName], [RatingCount]);
GO

-- Products: chronological ordering (recent products panel)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_CreatedAt_Desc')
    CREATE NONCLUSTERED INDEX [IX_Products_CreatedAt_Desc]
        ON [dbo].[Products] ([CreatedAt] DESC)
        INCLUDE ([ProductID], [ProductName], [CategoryID], [Price]);
GO

-- Products: supplier FK lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_SupplierID')
    CREATE NONCLUSTERED INDEX [IX_Products_SupplierID]
        ON [dbo].[Products] ([SupplierID]);
GO

-- ProductTags: lookup all tags for a product
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProductTags_ProductID')
    CREATE NONCLUSTERED INDEX [IX_ProductTags_ProductID]
        ON [dbo].[ProductTags] ([ProductID])
        INCLUDE ([TagID]);
GO

-- ProductTags: reverse lookup – all products with a given tag
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProductTags_TagID')
    CREATE NONCLUSTERED INDEX [IX_ProductTags_TagID]
        ON [dbo].[ProductTags] ([TagID])
        INCLUDE ([ProductID]);
GO

-- =============================================================================
-- VIEW: vw_ProductFull
-- Purpose:  Denormalized read-model that joins Products with Categories, Suppliers
--           and aggregates Tags into a comma-separated string.  Used by the
--           repository layer to keep SQL in JS files minimal.
-- =============================================================================
CREATE OR ALTER VIEW [dbo].[vw_ProductFull]
AS
SELECT
    p.[ProductID],
    p.[ProductName],
    c.[CategoryName]                                         AS [Category],
    p.[SubCategory],
    p.[Description],
    p.[Price],
    p.[Currency],
    p.[Stock],
    p.[Unit],
    p.[Rating],
    p.[RatingCount],
    p.[Status],
    ISNULL(s.[SupplierName], N'')                            AS [Supplier],
    -- STRING_AGG requires SQL Server 2017+; produces comma-separated tag list
    ISNULL(
        STRING_AGG(t.[TagName], N',') WITHIN GROUP (ORDER BY t.[TagName]),
        N''
    )                                                        AS [TagsCSV],
    p.[Featured],
    p.[Discount],
    p.[Weight],
    p.[Dimensions],
    -- Return dates as ISO-8601 strings so JSON serialisation is consistent
    CONVERT(NVARCHAR(10), p.[CreatedAt],  23)                AS [CreatedAt],
    CONVERT(NVARCHAR(10), p.[ModifiedAt], 23)                AS [ModifiedAt]
FROM       [dbo].[Products]     p
INNER JOIN [dbo].[Categories]   c  ON p.[CategoryID] = c.[CategoryID]
LEFT  JOIN [dbo].[Suppliers]    s  ON p.[SupplierID]  = s.[SupplierID]
LEFT  JOIN [dbo].[ProductTags]  pt ON p.[ProductID]   = pt.[ProductID]
LEFT  JOIN [dbo].[Tags]         t  ON pt.[TagID]      = t.[TagID]
GROUP BY
    p.[ProductID], p.[ProductName], c.[CategoryName], p.[SubCategory],
    p.[Description], p.[Price], p.[Currency], p.[Stock], p.[Unit],
    p.[Rating], p.[RatingCount], p.[Status], s.[SupplierName],
    p.[Featured], p.[Discount], p.[Weight], p.[Dimensions],
    p.[CreatedAt], p.[ModifiedAt];
GO

-- =============================================================================
-- STORED PROCEDURE: sp_GetNextProductID
-- Purpose:  Atomically increments the ProductIDSequence counter and returns the
--           next ID in the format P001, P002, …, P999.
--           Uses UPDLOCK + SERIALIZABLE hints to be safe under concurrent load.
-- =============================================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_GetNextProductID]
    @NewProductID  NVARCHAR(10)  OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextNum INT;

    UPDATE [dbo].[ProductIDSequence]
    WITH   (UPDLOCK, SERIALIZABLE)
    SET    @NextNum = [LastNumber] = [LastNumber] + 1;

    -- Format: P + zero-padded 3-digit number (grows beyond 3 digits naturally)
    SET @NewProductID = N'P' + RIGHT(N'000' + CAST(@NextNum AS NVARCHAR(10)), 3);
END;
GO

-- =============================================================================
-- STORED PROCEDURE: sp_GetProductStats
-- Purpose:  Aggregates KPI metrics for the home-page tiles in a single, indexed
--           pass over the Products table — much more efficient than 6 separate
--           COUNT queries from the application layer.
-- =============================================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_GetProductStats]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*)                                                   AS [TotalProducts],
        SUM(CASE WHEN [Status] = N'Active'       THEN 1 ELSE 0 END) AS [ActiveProducts],
        SUM(CASE WHEN [Status] = N'Inactive'     THEN 1 ELSE 0 END) AS [InactiveProducts],
        SUM(CASE WHEN [Status] = N'Discontinued' THEN 1 ELSE 0 END) AS [DiscontinuedProducts],
        SUM(CASE WHEN [Featured] = 1             THEN 1 ELSE 0 END) AS [FeaturedProducts],
        SUM(CASE WHEN [Stock] < 10               THEN 1 ELSE 0 END) AS [LowStockProducts],
        COUNT(DISTINCT [CategoryID])                               AS [TotalCategories],
        ISNULL(AVG(CAST([Price] AS DECIMAL(10,2))), 0)             AS [AveragePrice]
    FROM [dbo].[Products];
END;
GO

-- =============================================================================
-- STORED PROCEDURE: sp_SyncProductIDSequence
-- Purpose:  Re-synchronises the sequence counter after bulk imports or manual
--           inserts that bypass sp_GetNextProductID.  Run after any bulk load.
-- =============================================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_SyncProductIDSequence]
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MaxNum INT;

    SELECT @MaxNum = ISNULL(MAX(CAST(SUBSTRING([ProductID], 2, LEN([ProductID])) AS INT)), 0)
    FROM   [dbo].[Products]
    WHERE  [ProductID] LIKE N'P[0-9]%';

    UPDATE [dbo].[ProductIDSequence]
    SET    [LastNumber] = @MaxNum;

    SELECT @MaxNum AS [SyncedTo];
END;
GO

PRINT 'Migration 002 complete: indexes, view, and stored procedures created.';
GO
