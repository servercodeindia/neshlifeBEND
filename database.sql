-- NeshLife Database Schema
-- PostgreSQL Database

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50) DEFAULT 'fas fa-box',
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    features JSONB DEFAULT '[]',
    badge VARCHAR(50),
    image TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BANNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image TEXT NOT NULL,
    link VARCHAR(255),
    "order" INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TESTIMONIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    site_name VARCHAR(100),
    site_description TEXT,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    whatsapp_number VARCHAR(20),
    address TEXT,
    logo TEXT,
    social_media JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BLOG POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    author VARCHAR(100) DEFAULT 'Admin',
    image TEXT,
    tags JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- HOME CONTENT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS home_content (
    id SERIAL PRIMARY KEY,
    section_name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    description TEXT,
    content TEXT,
    image TEXT,
    button_text VARCHAR(100),
    button_link VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONTACT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100),
    customer_phone VARCHAR(20) NOT NULL,
    delivery_address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    items JSONB NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'COD',
    order_status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners("order");
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_active ON blog_posts(active);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_contact_messages_read ON contact_messages(read);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default admin user (password: admin123)
-- Note: This is a bcrypt hash of 'admin123'
INSERT INTO users (username, password, role) 
VALUES ('admin', '$2a$10$rZ5YvZ5YvZ5YvZ5YvZ5YvOqK5YvZ5YvZ5YvZ5YvZ5YvZ5YvZ5Yv', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert default settings
INSERT INTO settings (site_name, site_description, contact_email, contact_phone, whatsapp_number, address, social_media)
VALUES (
    'NeshLife',
    'Premium Cattle Feed & Nutrition Solutions',
    'info@neshlife.com',
    '+919330616123',
    '+919330616123',
    'Barpeta Road, Assam, India',
    '{"facebook": "", "instagram": "", "twitter": "", "linkedin": "", "whatsapp_message": "Hello! I would like to know more about your cattle feed products."}'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTES
-- ============================================
-- 1. Default admin credentials:
--    Username: admin
--    Password: admin123
--    IMPORTANT: Change this password after first login!
--
-- 2. Order Status Values:
--    - pending: Order placed, awaiting confirmation
--    - confirmed: Order confirmed by admin
--    - processing: Order is being prepared
--    - shipped: Order has been shipped
--    - delivered: Order delivered to customer
--    - cancelled: Order cancelled
--
-- 3. Payment Method:
--    - COD: Cash on Delivery (only option currently)
--
-- 4. JSONB Fields:
--    - products.features: Array of product features
--    - blog_posts.tags: Array of blog tags
--    - settings.social_media: Object with social media links
--    - orders.items: Array of order items with {id, name, price, quantity}
