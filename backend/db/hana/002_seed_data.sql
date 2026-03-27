-- =============================================================================
-- 002_seed_data.sql  —  Initial seed data for Product Catalog Manager (HANA)
-- =============================================================================
-- Run AFTER 001_schema.sql.
-- Inserts 5 categories, 10 suppliers, 10 tags, and 25 products (matching
-- the existing mock data in webapp/localService/mockdata/products.json).
--
-- After the inserts, the sequence is restarted at 26 so the next
-- auto-generated ProductID will be P026 (matching P001–P025 in seed).
-- =============================================================================


-- =============================================================================
-- CATEGORIES
-- =============================================================================
INSERT INTO "Categories" ("CategoryName", "Description", "IsActive") VALUES
    ('Electronics',       'Electronic devices and accessories',              TRUE),
    ('Furniture',         'Office and home furniture',                       TRUE),
    ('Clothing',          'Apparel and fashion items',                       TRUE),
    ('Food & Beverage',   'Food products and beverages',                     TRUE),
    ('Office Supplies',   'Stationery and office equipment',                 TRUE);


-- =============================================================================
-- SUPPLIERS
-- =============================================================================
INSERT INTO "Suppliers" ("SupplierName", "ContactEmail", "Country", "IsActive") VALUES
    ('TechSource Global',      'orders@techsource.com',     'USA',         TRUE),
    ('Nordic Design Co',       'sales@nordicdesign.no',     'Norway',      TRUE),
    ('FashionForward Ltd',     'trade@fashionforward.uk',   'UK',          TRUE),
    ('Gourmet Imports SA',     'info@gourmetimports.fr',    'France',      TRUE),
    ('Office Essentials Inc',  'supply@officeessentials.ca','Canada',      TRUE),
    ('ElectroHub Asia',        'b2b@electrohub.sg',         'Singapore',   TRUE),
    ('Heritage Furnishings',   'orders@heritagefurn.de',    'Germany',     TRUE),
    ('FreshProduce Direct',    'wholesale@freshproduce.au', 'Australia',   TRUE),
    ('StyleHouse Barcelona',   'export@stylehouse.es',      'Spain',       TRUE),
    ('PrimeParts Corp',        'sales@primeparts.us',       'USA',         TRUE);


-- =============================================================================
-- TAGS
-- =============================================================================
INSERT INTO "Tags" ("TagName") VALUES
    ('new-arrival'),
    ('best-seller'),
    ('sale'),
    ('eco-friendly'),
    ('premium'),
    ('wireless'),
    ('organic'),
    ('ergonomic'),
    ('limited-edition'),
    ('bundle');


-- =============================================================================
-- PRODUCTS  (P001 – P025)
-- =============================================================================
-- CategoryID reference:
--   1=Electronics  2=Furniture  3=Clothing  4=Food & Beverage  5=Office Supplies
-- SupplierID reference: sequential from INSERT above (1–10)

INSERT INTO "Products" (
    "ProductID","ProductName","CategoryID","SubCategory","Description",
    "Price","Currency","Stock","Unit","Status","SupplierID",
    "Featured","Discount","Weight","Dimensions","Rating","RatingCount",
    "CreatedAt","ModifiedAt"
) VALUES
('P001','ProBook Elite 15 Laptop',       1,'Laptops',        'High-performance laptop with Intel Core i7, 16GB RAM, 512GB SSD, 15.6" display.',     1299.99,'USD',45, 'EA','Active',      1,TRUE, 10,'2.1 kg','35.6 x 24.2 x 1.9 cm',4.7,234,'2024-01-15','2024-03-10'),
('P002','UltraWide 34" Monitor',         1,'Monitors',       '34-inch ultrawide curved monitor, 3440x1440 resolution, 100Hz, USB-C connectivity.', 799.99, 'USD',28, 'EA','Active',      6,FALSE, 5,'5.8 kg','81.0 x 38.0 x 5.5 cm',4.5,189,'2024-01-20','2024-02-28'),
('P003','Wireless Noise-Cancel Headset', 1,'Audio',          'Professional wireless headset with ANC, 30-hour battery, foldable design.',           249.99, 'USD',120,'EA','Active',      6,FALSE,15,'0.25 kg','19 x 16 x 8 cm',   4.8,512,'2024-02-01','2024-03-15'),
('P004','Mechanical Keyboard RGB',       1,'Peripherals',    'Tenkeyless mechanical keyboard with Cherry MX switches, per-key RGB, USB-C.',         159.99, 'USD',75, 'EA','Active',      1,FALSE, 0,'0.92 kg','36 x 13 x 3.5 cm',  4.6,301,'2024-02-10','2024-03-01'),
('P005','4K Webcam Pro',                 1,'Peripherals',    '4K 30fps webcam with autofocus, dual mics, ring light, plug-and-play.',               119.99, 'USD',200,'EA','Active',      6,TRUE,  0,'0.18 kg','9.5 x 6 x 5 cm',    4.3,421,'2024-02-15','2024-03-20'),
('P006','Executive Standing Desk',       2,'Desks',          'Height-adjustable standing desk 160x80cm, dual-motor lift, programmable presets.',    1199.99,'USD', 8, 'EA','Active',      7,TRUE, 20,'38 kg', '160 x 80 x 72-120 cm',4.9,67, '2024-01-10','2024-02-20'),
('P007','Ergonomic Office Chair',        2,'Chairs',         'Full-support ergonomic chair with lumbar adjustment, breathable mesh, armrests.',      699.99, 'USD',22, 'EA','Active',      2,FALSE, 0,'15.5 kg','66 x 68 x 120 cm',  4.8,143,'2024-01-25','2024-03-05'),
('P008','3-Drawer Filing Cabinet',       2,'Storage',        'Steel 3-drawer filing cabinet, A4 compatible, lock with two keys, on castors.',       329.99, 'EUR',15, 'EA','Active',      7,FALSE, 0,'22 kg', '46 x 62 x 102 cm',  4.4,88, '2024-02-05','2024-02-25'),
('P009','Minimalist Bookshelf',          2,'Shelving',       'Wall-mounted oak veneer bookshelf, 5 adjustable shelves, max 25 kg per shelf.',        249.99, 'EUR',31, 'EA','Active',      2,FALSE, 5,'11.5 kg','90 x 24 x 180 cm',  4.6,55, '2024-03-01','2024-03-20'),
('P010','Premium Merino Wool Sweater',   3,'Knitwear',       '100% Merino wool pullover sweater, available in 6 colours, machine washable.',          89.99, 'GBP',60, 'EA','Active',      3,FALSE, 0,'0.38 kg','packed 30x20x5 cm', 4.7,178,'2024-01-30','2024-03-10'),
('P011','Organic Cotton T-Shirt 3-Pack', 3,'Casual Wear',    'GOTS-certified organic cotton, pre-shrunk, available S–XXL, classic fit.',              39.99, 'GBP',150,'EA','Active',      9,FALSE, 0,'0.3 kg', 'packed 20x15x4 cm', 4.5,267,'2024-02-08','2024-03-15'),
('P012','Slim Fit Chino Trousers',       3,'Trousers',       'Stretch cotton chino, slim fit, 4 pockets, available in beige, navy, olive, grey.',     69.99, 'GBP',80, 'EA','Inactive',    3,FALSE, 0,'0.45 kg','packed 30x20x3 cm', 4.2,110,'2024-02-12','2024-03-18'),
('P013','Waterproof Hiking Jacket',      3,'Outerwear',      'Gore-Tex waterproof jacket, 3-layer construction, sealed seams, adjustable hood.',     199.99, 'GBP', 3, 'EA','Active',      9,FALSE,25,'0.65 kg','packed 35x25x8 cm', 4.9,42, '2024-03-05','2024-03-22'),
('P014','Cold Brew Coffee Concentrate',  4,'Beverages',      '1L cold brew concentrate, single-origin Ethiopia, 2:1 dilution ratio, shelf-stable.', 24.99,  'USD',200,'L', 'Active',      4,FALSE, 0,'1.05 kg','10 x 10 x 28 cm',   4.6,389,'2024-01-22','2024-03-08'),
('P015','Organic Granola Variety Pack',  4,'Snacks',         '6-pack organic granola 400g bags: almond, berry, chocolate, plain, honey, coconut.',   34.99,  'USD',120,'EA','Active',      8,FALSE, 0,'2.5 kg', '30 x 20 x 18 cm',   4.4,220,'2024-02-03','2024-03-12'),
('P016','Artisan Dark Chocolate Box',    4,'Confectionery',  'Luxury dark chocolate selection, 24 pralines, single-origin cacao, gift packaging.',   49.99,  'EUR',75, 'EA','Active',      4,TRUE,  0,'0.55 kg','22 x 16 x 6 cm',    4.8,155,'2024-02-18','2024-03-16'),
('P017','Himalayan Pink Salt 5 kg',      4,'Pantry',         'Coarse Himalayan pink salt, food grade, bulk pack, rich in minerals.',                  19.99,  'EUR',300,'KG','Active',      8,FALSE, 0,'5.2 kg', '28 x 18 x 8 cm',    4.3,98, '2024-03-10','2024-03-25'),
('P018','Premium Ballpoint Pen Set',     5,'Writing',        'Set of 10 premium ballpoint pens, smooth ink, ergonomic grip, black/blue/red mix.',     14.99,  'USD',500,'EA','Active',      5,FALSE, 0,'0.12 kg','14 x 12 x 2.5 cm',  4.5,332,'2024-01-18','2024-03-06'),
('P019','A4 Printer Paper 5-Ream Box',   5,'Paper',          '500 sheets per ream, 80 gsm, acid-free, suitable for laser and inkjet printers.',       45.99,  'USD',250,'EA','Active',      5,FALSE, 0,'12.5 kg','33 x 26 x 25 cm',   4.7,201,'2024-01-28','2024-03-14'),
('P020','Wireless Laser Presenter',      5,'Presentation',   'RF 2.4GHz wireless presenter, red laser, USB receiver, 30m range, Mac/Windows.',        39.99,  'USD',60, 'EA','Active',      1,FALSE, 0,'0.08 kg','15 x 4 x 2 cm',     4.4,167,'2024-02-22','2024-03-18'),
('P021','Smart Power Strip 6-Port',      1,'Accessories',    '6-outlet smart strip with 4 USB-A ports, surge protection, app control.',                89.99,  'USD', 7, 'EA','Active',      6,FALSE, 0,'0.48 kg','32 x 9 x 4 cm',     4.6,215,'2024-02-25','2024-03-22'),
('P022','Adjustable Monitor Arm',        2,'Accessories',    'Single-monitor arm, VESA 75/100mm, full motion, cable management, desk clamp.',         79.99,  'EUR',40, 'EA','Active',      7,FALSE, 0,'2.1 kg', '18 x 18 x 35 cm',   4.5,130,'2024-03-03','2024-03-23'),
('P023','Bamboo Desk Organiser',         5,'Desk Accessories','Eco bamboo organiser with pen holders, drawer, phone stand, cable slots.',              34.99,  'USD',90, 'EA','Active',      5,TRUE,  0,'0.62 kg','25 x 18 x 12 cm',   4.7,280,'2024-03-08','2024-03-25'),
('P024','Portable Bluetooth Speaker',   1,'Audio',           'IPX7 waterproof speaker, 360° sound, 20hr battery, USB-C charge, 10m range.',           99.99,  'USD',55, 'EA','Discontinued',6,FALSE,30,'0.55 kg','17 x 7 x 7 cm',     4.2,98, '2024-01-05','2024-02-10'),
('P025','Insulated Travel Mug 500ml',    4,'Drinkware',       'Double-wall vacuum insulated, keeps hot 12hr/cold 24hr, spill-proof lid, BPA free.',    29.99,  'USD',180,'EA','Active',      8,FALSE, 0,'0.31 kg','9 x 9 x 20 cm',     4.8,445,'2024-03-12','2024-03-26');


-- =============================================================================
-- PRODUCT TAGS  (junction table)
-- =============================================================================
-- TagID reference:
--   1=new-arrival  2=best-seller  3=sale  4=eco-friendly  5=premium
--   6=wireless     7=organic      8=ergonomic  9=limited-edition  10=bundle
INSERT INTO "ProductTags" ("ProductID","TagID") VALUES
('P001',1),('P001',5),('P001',2),
('P002',5),('P002',8),
('P003',6),('P003',5),('P003',2),
('P004',1),('P004',5),
('P005',1),('P005',6),
('P006',8),('P006',5),('P006',1),
('P007',8),('P007',2),
('P008',5),
('P009',4),('P009',5),
('P010',5),('P010',4),
('P011',4),('P011',7),
('P012',3),
('P013',5),('P013',3),
('P014',4),('P014',7),('P014',2),
('P015',4),('P015',7),('P015',10),
('P016',5),('P016',9),('P016',1),
('P017',4),('P017',7),
('P018',10),('P018',2),
('P019',2),
('P020',1),
('P021',1),('P021',6),
('P022',8),('P022',5),
('P023',4),('P023',1),('P023',8),
('P024',3),('P024',6),
('P025',4),('P025',2);


-- =============================================================================
-- RESET SEQUENCE
-- =============================================================================
-- After seeding P001–P025, restart the sequence at 26 so the next product
-- generated by the application will be P026.
ALTER SEQUENCE "ProductIDSeq" RESTART WITH 26;
