-- =============================================================================
-- PRODUCT CATALOG MANAGER  |  Seed Data
-- Seed: 001_seed_data.sql
-- Fix: sp_SeedProductTag created in its own batch (before BEGIN TRANSACTION)
--      so it satisfies the "first statement in batch" rule for CREATE PROCEDURE.
-- =============================================================================

-- NOTE: Connect SSMS directly to ProductCatalogDB before running this script.
-- The USE statement is not supported on Azure SQL.

-- =============================================================================
-- HELPER PROCEDURE  (must be its own batch — separated by GO before and after)
-- Creates a ProductTag row if the product + tag combination does not yet exist.
-- =============================================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_SeedProductTag]
    @ProductID NVARCHAR(10),
    @TagName   NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TagID INT;
    SELECT @TagID = [TagID] FROM [dbo].[Tags] WHERE [TagName] = @TagName;
    IF @TagID IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM [dbo].[ProductTags]
        WHERE [ProductID] = @ProductID AND [TagID] = @TagID
    )
        INSERT INTO [dbo].[ProductTags] ([ProductID],[TagID]) VALUES (@ProductID, @TagID);
END;
GO

-- =============================================================================
-- All data inserts run inside a single transaction so that if anything fails
-- mid-way, nothing is left in a partial state.
-- =============================================================================
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- =============================================================================
-- 1. CATEGORIES
-- =============================================================================
MERGE [dbo].[Categories] AS target
USING (VALUES
    (N'Electronics',      N'Consumer electronics, computers, and accessories'),
    (N'Furniture',        N'Office and home furniture'),
    (N'Clothing',         N'Apparel, footwear, and accessories'),
    (N'Food & Beverage',  N'Food products, beverages, and consumables'),
    (N'Office Supplies',  N'Stationery, writing instruments, and desk accessories')
) AS source ([CategoryName], [Description])
ON target.[CategoryName] = source.[CategoryName]
WHEN NOT MATCHED THEN
    INSERT ([CategoryName], [Description]) VALUES (source.[CategoryName], source.[Description]);

-- =============================================================================
-- 2. SUPPLIERS
-- =============================================================================
MERGE [dbo].[Suppliers] AS target
USING (VALUES
    (N'TechVision Corp'),
    (N'SoundWave Industries'),
    (N'DisplayTech GmbH'),
    (N'KeyMaster Solutions'),
    (N'ErgoComfort Ltd'),
    (N'FlexSpace Furniture'),
    (N'WoodCraft Studio'),
    (N'OfficeElite Inc'),
    (N'MetalWorks Ltd'),
    (N'Milano Fashion House'),
    (N'ActiveGear Co'),
    (N'NatureFibre Co'),
    (N'LuxeKnit Atelier'),
    (N'BrewMaster Roasters'),
    (N'Hearth & Stone Bakery'),
    (N'Golden Apiary Farm'),
    (N'Uji Tea Masters'),
    (N'Cacao Couture'),
    (N'PrecisionWrite GmbH'),
    (N'PageCraft Supplies'),
    (N'InkCraft Stationery'),
    (N'DeskTech Accessories'),
    (N'ViewTech Solutions'),
    (N'ComfortWork Furniture'),
    (N'GreenThread Apparel'),
    (N'PeakPerformance Wear'),
    (N'Highland Roasters Co.'),
    (N'Zen Garden Imports')
) AS source ([SupplierName])
ON target.[SupplierName] = source.[SupplierName]
WHEN NOT MATCHED THEN
    INSERT ([SupplierName]) VALUES (source.[SupplierName]);

-- =============================================================================
-- 3. TAGS
-- =============================================================================
MERGE [dbo].[Tags] AS target
USING (VALUES
    (N'laptop'),(N'business'),(N'4K'),(N'ultrabook'),
    (N'headphones'),(N'ANC'),(N'wireless'),(N'audio'),
    (N'smartwatch'),(N'health'),(N'fitness'),(N'wearable'),
    (N'monitor'),(N'IPS'),(N'USB-C'),
    (N'keyboard'),(N'mechanical'),(N'RGB'),(N'TKL'),
    (N'chair'),(N'ergonomic'),(N'office'),(N'lumbar'),
    (N'desk'),(N'standing'),(N'electric'),(N'adjustable'),
    (N'bookshelf'),(N'oak'),(N'storage'),(N'home'),
    (N'conference'),(N'table'),(N'meeting'),
    (N'cabinet'),(N'filing'),(N'steel'),
    (N'blazer'),(N'wool'),(N'formal'),(N'slim-fit'),
    (N'shoes'),(N'trail'),(N'running'),(N'waterproof'),
    (N'dress'),(N'linen'),(N'summer'),(N'casual'),
    (N'tights'),(N'compression'),(N'activewear'),(N'gym'),
    (N'sweater'),(N'cashmere'),(N'luxury'),(N'knitwear'),
    (N'coffee'),(N'cold-brew'),(N'organic'),(N'concentrate'),
    (N'bread'),(N'sourdough'),(N'artisan'),(N'bakery'),
    (N'honey'),(N'raw'),(N'natural'),
    (N'matcha'),(N'japanese'),(N'tea'),
    (N'chocolate'),(N'dark'),(N'gift'),
    (N'pen'),(N'titanium'),(N'writing'),
    (N'notebook'),(N'hardcover'),(N'A4'),(N'stationery'),
    (N'fountain'),(N'executive'),
    (N'charging'),(N'Qi'),
    (N'UHD'),(N'display'),(N'streaming'),(N'remote-work'),
    (N'webcam'),(N'HD'),
    (N'hoodie'),(N'cotton'),(N'fleece'),
    (N'jacket'),(N'sports'),
    (N'arabica'),(N'premium'),
    (N'ceremonial')
) AS source ([TagName])
ON target.[TagName] = source.[TagName]
WHEN NOT MATCHED THEN
    INSERT ([TagName]) VALUES (source.[TagName]);

-- =============================================================================
-- 4. PRODUCTS
-- =============================================================================
MERGE [dbo].[Products] AS target
USING (VALUES
  (N'P001',N'ProBook Elite 15 Laptop',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Laptops',
   N'High-performance business laptop with Intel Core i7 and 16GB RAM.',
   1299.99,N'USD',45,N'EA',4.7,312,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'TechVision Corp'),
   1,10,N'1.8 kg',N'35.6 x 24.3 x 1.8 cm',
   CAST(N'2023-11-15' AS DATETIME2(0)),CAST(N'2024-08-20' AS DATETIME2(0))),
  (N'P002',N'NoisePro ANC Headphones',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Audio',
   N'Premium over-ear headphones with active noise cancellation.',
   349.99,N'USD',120,N'EA',4.5,487,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'SoundWave Industries'),
   0,0,N'0.35 kg',N'19.0 x 17.5 x 8.0 cm',
   CAST(N'2023-09-05' AS DATETIME2(0)),CAST(N'2024-07-12' AS DATETIME2(0))),
  (N'P003',N'SmartWatch Pro X',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Wearables',
   N'Advanced health monitoring with ECG and AMOLED display.',
   499.99,N'USD',78,N'EA',4.6,203,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'TechVision Corp'),
   1,0,N'0.045 kg',N'4.5 x 3.8 x 1.0 cm',
   CAST(N'2024-01-10' AS DATETIME2(0)),CAST(N'2024-09-01' AS DATETIME2(0))),
  (N'P004',N'UltraSharp 27 Monitor',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Monitors',
   N'Professional 27-inch 4K IPS monitor with 99% Adobe RGB coverage.',
   799.99,N'USD',34,N'EA',4.8,156,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'DisplayTech GmbH'),
   0,15,N'6.2 kg',N'61.3 x 36.8 x 5.3 cm',
   CAST(N'2023-12-20' AS DATETIME2(0)),CAST(N'2024-06-15' AS DATETIME2(0))),
  (N'P005',N'Mechanical Keyboard TKL',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Peripherals',
   N'TKL mechanical keyboard with Cherry MX Red switches and per-key RGB.',
   159.99,N'USD',89,N'EA',4.4,341,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'KeyMaster Solutions'),
   0,0,N'0.92 kg',N'36.0 x 14.0 x 3.8 cm',
   CAST(N'2023-08-14' AS DATETIME2(0)),CAST(N'2024-05-22' AS DATETIME2(0))),
  (N'P006',N'Executive Ergonomic Chair',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Furniture'),N'Seating',
   N'Premium ergonomic office chair with 12-way adjustable lumbar support.',
   899.99,N'USD',22,N'EA',4.9,428,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'ErgoComfort Ltd'),
   1,0,N'18.5 kg',N'68.0 x 68.0 x 120.0 cm',
   CAST(N'2023-06-01' AS DATETIME2(0)),CAST(N'2024-09-10' AS DATETIME2(0))),
  (N'P007',N'Standing Desk Pro 160',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Furniture'),N'Desks',
   N'Electric height-adjustable standing desk with quiet dual motor system.',
   749.99,N'USD',15,N'EA',4.6,189,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'FlexSpace Furniture'),
   0,20,N'52.0 kg',N'160.0 x 80.0 x 72.0 cm',
   CAST(N'2023-10-08' AS DATETIME2(0)),CAST(N'2024-08-05' AS DATETIME2(0))),
  (N'P008',N'Bookshelf 5-Tier Oak',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Furniture'),N'Storage',
   N'Solid oak five-tier bookshelf with warm natural finish.',
   299.99,N'USD',41,N'EA',4.3,97,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'WoodCraft Studio'),
   0,0,N'32.0 kg',N'80.0 x 30.0 x 180.0 cm',
   CAST(N'2023-07-22' AS DATETIME2(0)),CAST(N'2024-04-18' AS DATETIME2(0))),
  (N'P009',N'Conference Table Oval 12',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Furniture'),N'Tables',
   N'Oval conference table seating 12 with integrated cable management.',
   2499.99,N'USD',8,N'EA',4.5,42,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'OfficeElite Inc'),
   0,0,N'145.0 kg',N'360.0 x 140.0 x 75.0 cm',
   CAST(N'2023-05-14' AS DATETIME2(0)),CAST(N'2024-07-30' AS DATETIME2(0))),
  (N'P010',N'Filing Cabinet 4-Drawer',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Furniture'),N'Storage',
   N'Heavy-duty steel filing cabinet with anti-tilt and cam lock system.',
   349.99,N'USD',28,N'EA',4.2,73,N'Inactive',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'MetalWorks Ltd'),
   0,25,N'38.5 kg',N'46.5 x 62.0 x 132.0 cm',
   CAST(N'2022-11-30' AS DATETIME2(0)),CAST(N'2024-03-12' AS DATETIME2(0))),
  (N'P011',N'Premium Wool Blazer',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Clothing'),N'Formal Wear',
   N'Slim-fit blazer crafted from 100% Italian merino wool.',
   449.99,N'USD',63,N'EA',4.8,215,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'Milano Fashion House'),
   1,0,N'0.95 kg',N'60.0 x 45.0 x 5.0 cm',
   CAST(N'2023-09-20' AS DATETIME2(0)),CAST(N'2024-08-15' AS DATETIME2(0))),
  (N'P012',N'Trail Runner Pro Shoes',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Clothing'),N'Footwear',
   N'High-performance trail running shoes with Vibram outsole.',
   189.99,N'USD',155,N'EA',4.6,392,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'ActiveGear Co'),
   0,10,N'0.31 kg',N'32.0 x 12.0 x 10.0 cm',
   CAST(N'2024-02-08' AS DATETIME2(0)),CAST(N'2024-09-05' AS DATETIME2(0))),
  (N'P013',N'Linen Summer Dress',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Clothing'),N'Casual Wear',
   N'OEKO-TEX certified 100% European linen midi dress.',
   129.99,N'USD',87,N'EA',4.4,178,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'NatureFibre Co'),
   0,0,N'0.42 kg',N'35.0 x 25.0 x 3.0 cm',
   CAST(N'2024-03-15' AS DATETIME2(0)),CAST(N'2024-09-20' AS DATETIME2(0))),
  (N'P014',N'Performance Compression Tights',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Clothing'),N'Activewear',
   N'Graduated compression tights with moisture-wicking four-way stretch fabric.',
   79.99,N'USD',200,N'EA',4.3,263,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'ActiveGear Co'),
   0,0,N'0.22 kg',N'30.0 x 20.0 x 2.0 cm',
   CAST(N'2023-11-02' AS DATETIME2(0)),CAST(N'2024-07-08' AS DATETIME2(0))),
  (N'P015',N'Cashmere Turtleneck Sweater',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Clothing'),N'Knitwear',
   N'Grade-A Mongolian cashmere turtleneck in classic ribbed pattern.',
   259.99,N'USD',7,N'EA',4.9,88,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'LuxeKnit Atelier'),
   0,0,N'0.55 kg',N'38.0 x 30.0 x 4.0 cm',
   CAST(N'2023-10-01' AS DATETIME2(0)),CAST(N'2024-01-20' AS DATETIME2(0))),
  (N'P016',N'Cold Brew Coffee Concentrate',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Food & Beverage'),N'Coffee',
   N'Small-batch cold brew from single-origin Ethiopian Yirgacheffe beans.',
   24.99,N'USD',175,N'EA',4.7,421,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'BrewMaster Roasters'),
   1,0,N'1.1 kg',N'10.0 x 10.0 x 28.0 cm',
   CAST(N'2024-04-01' AS DATETIME2(0)),CAST(N'2024-09-15' AS DATETIME2(0))),
  (N'P017',N'Artisan Sourdough Bread',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Food & Beverage'),N'Bakery',
   N'Traditional sourdough loaf fermented 72 hours with a 15-year-old starter.',
   12.99,N'USD',60,N'EA',4.8,189,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'Hearth & Stone Bakery'),
   0,0,N'0.85 kg',N'28.0 x 14.0 x 12.0 cm',
   CAST(N'2024-05-10' AS DATETIME2(0)),CAST(N'2024-09-18' AS DATETIME2(0))),
  (N'P018',N'Raw Wildflower Honey 500g',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Food & Beverage'),N'Natural Foods',
   N'Unfiltered, unpasteurised wildflower honey retaining all natural enzymes.',
   18.99,N'USD',143,N'EA',4.6,302,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'Golden Apiary Farm'),
   0,0,N'0.65 kg',N'9.0 x 9.0 x 12.0 cm',
   CAST(N'2023-08-20' AS DATETIME2(0)),CAST(N'2024-08-25' AS DATETIME2(0))),
  (N'P019',N'Matcha Premium Ceremonial Grade',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Food & Beverage'),N'Tea',
   N'First-flush ceremonial-grade matcha stone-ground in Uji, Japan.',
   39.99,N'USD',95,N'EA',4.7,147,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'Uji Tea Masters'),
   0,15,N'0.08 kg',N'7.0 x 7.0 x 10.0 cm',
   CAST(N'2024-01-25' AS DATETIME2(0)),CAST(N'2024-09-12' AS DATETIME2(0))),
  (N'P020',N'Dark Chocolate Collection Box',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Food & Beverage'),N'Confectionery',
   N'24 hand-crafted dark chocolates from single-origin cacao.',
   54.99,N'USD',112,N'EA',4.9,356,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'Cacao Couture'),
   0,0,N'0.48 kg',N'25.0 x 20.0 x 5.0 cm',
   CAST(N'2023-12-01' AS DATETIME2(0)),CAST(N'2024-09-08' AS DATETIME2(0))),
  (N'P021',N'Ergonomic Pen Set Titanium',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Office Supplies'),N'Writing Instruments',
   N'Three professional rollerball pens machined from aerospace-grade titanium.',
   119.99,N'USD',54,N'EA',4.7,134,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'PrecisionWrite GmbH'),
   1,0,N'0.18 kg',N'20.0 x 8.0 x 3.0 cm',
   CAST(N'2024-02-14' AS DATETIME2(0)),CAST(N'2024-09-22' AS DATETIME2(0))),
  (N'P022',N'A4 Premium Notebook Hardcover',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Office Supplies'),N'Notebooks',
   N'240-page lay-flat notebook with 100gsm acid-free paper and cloth-bound hardcover.',
   34.99,N'USD',189,N'EA',4.5,278,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'PageCraft Supplies'),
   0,0,N'0.45 kg',N'30.0 x 21.0 x 2.0 cm',
   CAST(N'2024-01-05' AS DATETIME2(0)),CAST(N'2024-09-01' AS DATETIME2(0))),
  (N'P023',N'ProWrite Fountain Pen Set',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Office Supplies'),N'Writing Instruments',
   N'Executive fountain pen with stainless steel nib and converter filling system.',
   59.99,N'USD',75,N'EA',4.6,92,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'InkCraft Stationery'),
   0,0,N'0.12 kg',N'16.0 x 8.0 x 3.0 cm',
   CAST(N'2023-11-20' AS DATETIME2(0)),CAST(N'2024-07-14' AS DATETIME2(0))),
  (N'P024',N'SmartDesk Wireless Charging Pad',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Office Supplies'),N'Desk Accessories',
   N'Qi-certified 15W fast wireless charging pad with non-slip silicone base.',
   44.99,N'USD',88,N'EA',4.4,167,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'DeskTech Accessories'),
   1,0,N'0.09 kg',N'10.0 x 10.0 x 0.8 cm',
   CAST(N'2024-03-08' AS DATETIME2(0)),CAST(N'2024-09-10' AS DATETIME2(0))),
  (N'P025',N'UltraView 4K Monitor',
   (SELECT CategoryID FROM Categories WHERE CategoryName=N'Electronics'),N'Displays',
   N'27-inch 4K UHD IPS monitor with USB-C, HDR400, and ultra-thin bezel.',
   549.99,N'USD',38,N'EA',4.5,118,N'Active',
   (SELECT SupplierID FROM Suppliers WHERE SupplierName=N'ViewTech Solutions'),
   1,10,N'5.2 kg',N'61.3 x 42.1 x 19.8 cm',
   CAST(N'2024-05-01' AS DATETIME2(0)),CAST(N'2024-09-25' AS DATETIME2(0)))
) AS source (
    [ProductID],[ProductName],[CategoryID],[SubCategory],[Description],
    [Price],[Currency],[Stock],[Unit],[Rating],[RatingCount],[Status],
    [SupplierID],[Featured],[Discount],[Weight],[Dimensions],
    [CreatedAt],[ModifiedAt]
)
ON target.[ProductID] = source.[ProductID]
WHEN NOT MATCHED THEN INSERT (
    [ProductID],[ProductName],[CategoryID],[SubCategory],[Description],
    [Price],[Currency],[Stock],[Unit],[Rating],[RatingCount],[Status],
    [SupplierID],[Featured],[Discount],[Weight],[Dimensions],
    [CreatedAt],[ModifiedAt]
) VALUES (
    source.[ProductID],source.[ProductName],source.[CategoryID],source.[SubCategory],
    source.[Description],source.[Price],source.[Currency],source.[Stock],source.[Unit],
    source.[Rating],source.[RatingCount],source.[Status],source.[SupplierID],
    source.[Featured],source.[Discount],source.[Weight],source.[Dimensions],
    source.[CreatedAt],source.[ModifiedAt]
);

-- =============================================================================
-- 5. PRODUCTTAGS
-- =============================================================================
EXEC sp_SeedProductTag 'P001','laptop';    EXEC sp_SeedProductTag 'P001','business';
EXEC sp_SeedProductTag 'P001','4K';        EXEC sp_SeedProductTag 'P001','ultrabook';
EXEC sp_SeedProductTag 'P002','headphones';EXEC sp_SeedProductTag 'P002','ANC';
EXEC sp_SeedProductTag 'P002','wireless';  EXEC sp_SeedProductTag 'P002','audio';
EXEC sp_SeedProductTag 'P003','smartwatch';EXEC sp_SeedProductTag 'P003','health';
EXEC sp_SeedProductTag 'P003','fitness';   EXEC sp_SeedProductTag 'P003','wearable';
EXEC sp_SeedProductTag 'P004','monitor';   EXEC sp_SeedProductTag 'P004','4K';
EXEC sp_SeedProductTag 'P004','IPS';       EXEC sp_SeedProductTag 'P004','USB-C';
EXEC sp_SeedProductTag 'P005','keyboard';  EXEC sp_SeedProductTag 'P005','mechanical';
EXEC sp_SeedProductTag 'P005','RGB';       EXEC sp_SeedProductTag 'P005','TKL';
EXEC sp_SeedProductTag 'P006','chair';     EXEC sp_SeedProductTag 'P006','ergonomic';
EXEC sp_SeedProductTag 'P006','office';    EXEC sp_SeedProductTag 'P006','lumbar';
EXEC sp_SeedProductTag 'P007','desk';      EXEC sp_SeedProductTag 'P007','standing';
EXEC sp_SeedProductTag 'P007','electric';  EXEC sp_SeedProductTag 'P007','adjustable';
EXEC sp_SeedProductTag 'P008','bookshelf'; EXEC sp_SeedProductTag 'P008','oak';
EXEC sp_SeedProductTag 'P008','storage';   EXEC sp_SeedProductTag 'P008','home';
EXEC sp_SeedProductTag 'P009','conference';EXEC sp_SeedProductTag 'P009','table';
EXEC sp_SeedProductTag 'P009','meeting';   EXEC sp_SeedProductTag 'P009','office';
EXEC sp_SeedProductTag 'P010','cabinet';   EXEC sp_SeedProductTag 'P010','filing';
EXEC sp_SeedProductTag 'P010','steel';     EXEC sp_SeedProductTag 'P010','office';
EXEC sp_SeedProductTag 'P011','blazer';    EXEC sp_SeedProductTag 'P011','wool';
EXEC sp_SeedProductTag 'P011','formal';    EXEC sp_SeedProductTag 'P011','slim-fit';
EXEC sp_SeedProductTag 'P012','shoes';     EXEC sp_SeedProductTag 'P012','trail';
EXEC sp_SeedProductTag 'P012','running';   EXEC sp_SeedProductTag 'P012','waterproof';
EXEC sp_SeedProductTag 'P013','dress';     EXEC sp_SeedProductTag 'P013','linen';
EXEC sp_SeedProductTag 'P013','summer';    EXEC sp_SeedProductTag 'P013','casual';
EXEC sp_SeedProductTag 'P014','tights';    EXEC sp_SeedProductTag 'P014','compression';
EXEC sp_SeedProductTag 'P014','activewear';EXEC sp_SeedProductTag 'P014','gym';
EXEC sp_SeedProductTag 'P015','sweater';   EXEC sp_SeedProductTag 'P015','cashmere';
EXEC sp_SeedProductTag 'P015','luxury';    EXEC sp_SeedProductTag 'P015','knitwear';
EXEC sp_SeedProductTag 'P016','coffee';    EXEC sp_SeedProductTag 'P016','cold-brew';
EXEC sp_SeedProductTag 'P016','organic';   EXEC sp_SeedProductTag 'P016','concentrate';
EXEC sp_SeedProductTag 'P017','bread';     EXEC sp_SeedProductTag 'P017','sourdough';
EXEC sp_SeedProductTag 'P017','artisan';   EXEC sp_SeedProductTag 'P017','bakery';
EXEC sp_SeedProductTag 'P018','honey';     EXEC sp_SeedProductTag 'P018','raw';
EXEC sp_SeedProductTag 'P018','organic';   EXEC sp_SeedProductTag 'P018','natural';
EXEC sp_SeedProductTag 'P019','matcha';    EXEC sp_SeedProductTag 'P019','japanese';
EXEC sp_SeedProductTag 'P019','tea';       EXEC sp_SeedProductTag 'P019','organic';
EXEC sp_SeedProductTag 'P020','chocolate'; EXEC sp_SeedProductTag 'P020','dark';
EXEC sp_SeedProductTag 'P020','gift';      EXEC sp_SeedProductTag 'P020','artisan';
EXEC sp_SeedProductTag 'P021','pen';       EXEC sp_SeedProductTag 'P021','titanium';
EXEC sp_SeedProductTag 'P021','luxury';    EXEC sp_SeedProductTag 'P021','writing';
EXEC sp_SeedProductTag 'P022','notebook';  EXEC sp_SeedProductTag 'P022','hardcover';
EXEC sp_SeedProductTag 'P022','A4';        EXEC sp_SeedProductTag 'P022','stationery';
EXEC sp_SeedProductTag 'P023','pen';       EXEC sp_SeedProductTag 'P023','fountain';
EXEC sp_SeedProductTag 'P023','executive'; EXEC sp_SeedProductTag 'P023','writing';
EXEC sp_SeedProductTag 'P024','charging';  EXEC sp_SeedProductTag 'P024','wireless';
EXEC sp_SeedProductTag 'P024','Qi';        EXEC sp_SeedProductTag 'P024','desk';
EXEC sp_SeedProductTag 'P025','monitor';   EXEC sp_SeedProductTag 'P025','4K';
EXEC sp_SeedProductTag 'P025','display';   EXEC sp_SeedProductTag 'P025','UHD';

-- Sync the ID sequence so next INSERT gets P026
EXEC [dbo].[sp_SyncProductIDSequence];

COMMIT TRANSACTION;

PRINT 'Seed 001 complete: 25 products, categories, suppliers, and tags inserted.';
GO
