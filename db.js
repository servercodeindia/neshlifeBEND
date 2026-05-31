import pkg from 'pg';
const { Pool } = pkg;

// PostgreSQL connection configuration
// Support both connection string and individual parameters
const connectionString = process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING;

const pool = connectionString 
  ? new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'neshlife',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
    });

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);
  
  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create categories table
    await query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50) DEFAULT 'fas fa-box',
        description TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create products table
    await query(`
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
      )
    `);
    
    // Create banners table
    await query(`
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
      )
    `);
    
    // Create testimonials table
    await query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
        message TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create settings table
    await query(`
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
      )
    `);
    
    // Create blog_posts table
    await query(`
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
      )
    `);
    
    // Create home_content table
    await query(`
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
      )
    `);
    
    // Create contact_messages table
    await query(`
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
      )
    `);
    
    // Create orders table
    await query(`
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
      )
    `);
    
    // Create indexes
    await query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
    await query('CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)');
    await query('CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug)');
    await query('CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active)');
    await query('CREATE INDEX IF NOT EXISTS idx_banners_order ON banners("order")');
    await query('CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active)');
    await query('CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active)');
    await query('CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)');
    await query('CREATE INDEX IF NOT EXISTS idx_blog_posts_active ON blog_posts(active)');
    await query('CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category)');
    await query('CREATE INDEX IF NOT EXISTS idx_contact_messages_read ON contact_messages(read)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at)');
    
    // Insert default admin user (password: admin123)
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash('admin123', 10);
    await query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
      ['admin', hashedPassword, 'admin']
    );
    
    // Insert default settings
    const settingsCheck = await query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO settings (site_name, site_description, contact_email, contact_phone, whatsapp_number, address, social_media)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'NeshLife',
        'Premium Cattle Feed & Nutrition Solutions',
        '',
        '',
        '',
        '',
        JSON.stringify({ facebook: '', instagram: '', twitter: '', linkedin: '', whatsapp_message: '' })
      ]);
    }
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

export default pool;
