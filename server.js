import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, initializeDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'neshlife-super-secret-jwt-key-2024-change-in-production';

// Middleware
// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://shipmart.online',
      'http://localhost:5173',
      'http://localhost:5000'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directories exist
const UPLOAD_DIRS = [
  path.join(__dirname, 'uploads/products'),
  path.join(__dirname, 'uploads/banners')
];

UPLOAD_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize database
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Configure multer for products
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/products/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const productUpload = multer({ 
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Configure multer for banners
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/banners/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const bannerUpload = multer({ 
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: error.message 
    });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ============ CATEGORIES ROUTES ============
app.get('/api/categories', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM categories';
    const params = [];
    
    if (req.query.active === 'true') {
      queryText += ' WHERE active = true';
    }
    
    queryText += ' ORDER BY name ASC';
    
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category', error: error.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name, slug, icon, description, active } = req.body;
    
    // Check if slug already exists
    const existingCategory = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Category with this slug already exists' });
    }
    
    const result = await query(
      `INSERT INTO categories (name, slug, icon, description, active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, slug, icon || 'fas fa-box', description || '', active !== false]
    );
    
    res.status(201).json({ success: true, message: 'Category created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { name, slug, icon, description, active } = req.body;
    
    // Check if category exists
    const existingCategory = await query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Check if slug already exists (excluding current category)
    if (slug) {
      const slugCheck = await query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [slug, req.params.id]);
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Category with this slug already exists' });
      }
    }
    
    const result = await query(
      `UPDATE categories 
       SET name = COALESCE($1, name), 
           slug = COALESCE($2, slug), 
           icon = COALESCE($3, icon), 
           description = COALESCE($4, description), 
           active = COALESCE($5, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 
       RETURNING *`,
      [name, slug, icon, description, active, req.params.id]
    );
    
    res.json({ success: true, message: 'Category updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
  }
});

// ============ PRODUCTS ROUTES ============
app.get('/api/products', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product', error: error.message });
  }
});

app.post('/api/products', authenticateToken, productUpload.single('image'), async (req, res) => {
  try {
    const { name, category, description, price, features, badge, active } = req.body;
    const image = req.file ? `/uploads/products/${req.file.filename}` : req.body.image;
    const featuresArray = typeof features === 'string' ? JSON.parse(features) : features;
    
    const result = await query(
      `INSERT INTO products (name, category, description, price, features, badge, image, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [name, category, description, price, JSON.stringify(featuresArray), badge || '', image, active !== 'false']
    );
    
    res.status(201).json({ success: true, message: 'Product created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Failed to create product', error: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, productUpload.single('image'), async (req, res) => {
  try {
    const { name, category, description, price, features, badge, active } = req.body;
    
    // Check if product exists
    const existingProduct = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const image = req.file ? `/uploads/products/${req.file.filename}` : (req.body.image || existingProduct.rows[0].image);
    const featuresArray = features ? (typeof features === 'string' ? JSON.parse(features) : features) : existingProduct.rows[0].features;
    
    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name), 
           category = COALESCE($2, category), 
           description = COALESCE($3, description), 
           price = COALESCE($4, price), 
           features = COALESCE($5, features), 
           badge = COALESCE($6, badge), 
           image = COALESCE($7, image), 
           active = COALESCE($8, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 
       RETURNING *`,
      [name, category, description, price, JSON.stringify(featuresArray), badge, image, active !== 'false' && active !== false, req.params.id]
    );
    
    res.json({ success: true, message: 'Product updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product', error: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
  }
});

// ============ BANNERS ROUTES ============
app.get('/api/banners', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM banners';
    
    if (req.query.active === 'true') {
      queryText += ' WHERE active = true';
    }
    
    queryText += ' ORDER BY "order" ASC';
    
    const result = await query(queryText);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banners', error: error.message });
  }
});

app.post('/api/banners', authenticateToken, async (req, res) => {
  try {
    const { title, description, image, link, order, active } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image URL is required' });
    }
    
    const result = await query(
      `INSERT INTO banners (title, description, image, link, "order", active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [title || '', description || '', image, link || '', parseInt(order) || 0, active !== false]
    );
    
    res.status(201).json({ success: true, message: 'Banner created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to create banner', error: error.message });
  }
});

app.put('/api/banners/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, image, link, order, active } = req.body;
    
    // Check if banner exists
    const existingBanner = await query('SELECT * FROM banners WHERE id = $1', [req.params.id]);
    if (existingBanner.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    const result = await query(
      `UPDATE banners 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           image = COALESCE($3, image), 
           link = COALESCE($4, link), 
           "order" = COALESCE($5, "order"), 
           active = COALESCE($6, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [title, description, image, link, order ? parseInt(order) : null, active, req.params.id]
    );
    
    res.json({ success: true, message: 'Banner updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to update banner', error: error.message });
  }
});

app.delete('/api/banners/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM banners WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete banner', error: error.message });
  }
});

// ============ TESTIMONIALS ROUTES ============
app.get('/api/testimonials', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM testimonials';
    
    if (req.query.active === 'true') {
      queryText += ' WHERE active = true';
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get testimonials error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch testimonials', error: error.message });
  }
});

app.post('/api/testimonials', authenticateToken, async (req, res) => {
  try {
    const { name, location, rating, message, active } = req.body;
    
    const result = await query(
      `INSERT INTO testimonials (name, location, rating, message, active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, location, parseInt(rating) || 5, message, active !== false]
    );
    
    res.status(201).json({ success: true, message: 'Testimonial created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create testimonial error:', error);
    res.status(500).json({ success: false, message: 'Failed to create testimonial', error: error.message });
  }
});

app.put('/api/testimonials/:id', authenticateToken, async (req, res) => {
  try {
    const { name, location, rating, message, active } = req.body;
    
    const result = await query(
      `UPDATE testimonials 
       SET name = COALESCE($1, name), 
           location = COALESCE($2, location), 
           rating = COALESCE($3, rating), 
           message = COALESCE($4, message), 
           active = COALESCE($5, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 
       RETURNING *`,
      [name, location, rating ? parseInt(rating) : null, message, active, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    
    res.json({ success: true, message: 'Testimonial updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update testimonial error:', error);
    res.status(500).json({ success: false, message: 'Failed to update testimonial', error: error.message });
  }
});

app.delete('/api/testimonials/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    
    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Delete testimonial error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete testimonial', error: error.message });
  }
});

// ============ SETTINGS ROUTES ============
app.get('/api/settings', async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings LIMIT 1');
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
  }
});

app.put('/api/settings', authenticateToken, bannerUpload.single('logo'), async (req, res) => {
  try {
    console.log('=== Settings Update Request ===');
    console.log('Body:', req.body);
    console.log('File received:', req.file ? 'Yes' : 'No');
    
    // Extract all fields from request
    const {
      site_name,
      site_description,
      contact_email,
      contact_phone,
      whatsapp_number,
      address,
      social_media
    } = req.body;
    
    // Check if settings exist
    const existingSettings = await query('SELECT * FROM settings LIMIT 1');
    
    if (existingSettings.rows.length === 0) {
      console.log('No settings found, creating default...');
      const createResult = await query(
        `INSERT INTO settings (site_name, site_description, contact_email, contact_phone, whatsapp_number, address, logo, social_media)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          site_name || 'NeshLife',
          site_description || 'Premium Cattle Feed & Nutrition Solutions',
          contact_email || '',
          contact_phone || '',
          whatsapp_number || '',
          address || '',
          req.file ? `/uploads/banners/${req.file.filename}` : '',
          social_media || '{}'
        ]
      );
      
      return res.json({ success: true, message: 'Settings created successfully', data: createResult.rows[0] });
    }
    
    const settingsId = existingSettings.rows[0].id;
    const logo = req.file ? `/uploads/banners/${req.file.filename}` : existingSettings.rows[0].logo;
    
    console.log('Updating settings with ID:', settingsId);
    
    // Parse social_media if it's a string
    let socialMediaData = existingSettings.rows[0].social_media;
    if (social_media) {
      try {
        socialMediaData = typeof social_media === 'string' ? JSON.parse(social_media) : social_media;
      } catch (e) {
        console.error('Error parsing social_media:', e);
      }
    }
    
    // Update all settings
    const result = await query(
      `UPDATE settings 
       SET site_name = COALESCE($1, site_name),
           site_description = COALESCE($2, site_description),
           contact_email = COALESCE($3, contact_email),
           contact_phone = COALESCE($4, contact_phone),
           whatsapp_number = COALESCE($5, whatsapp_number),
           address = COALESCE($6, address),
           logo = COALESCE($7, logo),
           social_media = COALESCE($8, social_media),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 
       RETURNING *`,
      [
        site_name,
        site_description,
        contact_email,
        contact_phone,
        whatsapp_number,
        address,
        logo,
        socialMediaData,
        settingsId
      ]
    );
    
    if (result.rows.length === 0) {
      console.error('ERROR: UPDATE returned 0 rows');
      return res.status(400).json({ success: false, message: 'Failed to update settings' });
    }
    
    console.log('Success! Settings updated');
    res.json({ success: true, message: 'Settings updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('=== ERROR in settings update ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
  }
});

// ============ BLOG ROUTES ============
app.get('/api/blog', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM blog_posts';
    const params = [];
    
    if (req.query.active === 'true') {
      queryText += ' WHERE active = true';
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog posts', error: error.message });
  }
});

app.get('/api/blog/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM blog_posts WHERE id = $1 OR slug = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get blog post error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog post', error: error.message });
  }
});

app.post('/api/blog', authenticateToken, async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, image, tags, active } = req.body;
    
    // Check if slug already exists
    const existingPost = await query('SELECT id FROM blog_posts WHERE slug = $1', [slug]);
    if (existingPost.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Blog post with this slug already exists' });
    }
    
    const result = await query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, category, author, image, tags, active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [title, slug, excerpt, content, category || 'General', author || 'Admin', image || '', JSON.stringify(tags || []), active !== false]
    );
    
    res.status(201).json({ success: true, message: 'Blog post created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog post', error: error.message });
  }
});

app.put('/api/blog/:id', authenticateToken, async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, image, tags, active } = req.body;
    
    // Check if blog post exists
    const existingPost = await query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (existingPost.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    
    // Check if slug already exists (excluding current post)
    if (slug) {
      const slugCheck = await query('SELECT id FROM blog_posts WHERE slug = $1 AND id != $2', [slug, req.params.id]);
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Blog post with this slug already exists' });
      }
    }
    
    const result = await query(
      `UPDATE blog_posts 
       SET title = COALESCE($1, title), 
           slug = COALESCE($2, slug), 
           excerpt = COALESCE($3, excerpt), 
           content = COALESCE($4, content), 
           category = COALESCE($5, category), 
           author = COALESCE($6, author), 
           image = COALESCE($7, image), 
           tags = COALESCE($8, tags), 
           active = COALESCE($9, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 
       RETURNING *`,
      [title, slug, excerpt, content, category, author, image, tags ? JSON.stringify(tags) : null, active, req.params.id]
    );
    
    res.json({ success: true, message: 'Blog post updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update blog post error:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog post', error: error.message });
  }
});

app.delete('/api/blog/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM blog_posts WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    
    res.json({ success: true, message: 'Blog post deleted successfully' });
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog post', error: error.message });
  }
});

// ============ STATS ROUTES ============
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const productsResult = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = true) as active FROM products');
    const categoriesResult = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = true) as active FROM categories');
    const bannersResult = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = true) as active FROM banners');
    const testimonialsResult = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = true) as active, AVG(rating) as avg_rating FROM testimonials');
    const productsByCategoryResult = await query('SELECT category, COUNT(*) as count FROM products GROUP BY category');
    
    const stats = {
      products: {
        total: parseInt(productsResult.rows[0].total),
        active: parseInt(productsResult.rows[0].active),
        inactive: parseInt(productsResult.rows[0].total) - parseInt(productsResult.rows[0].active),
        byCategory: productsByCategoryResult.rows.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {})
      },
      categories: {
        total: parseInt(categoriesResult.rows[0].total),
        active: parseInt(categoriesResult.rows[0].active),
        inactive: parseInt(categoriesResult.rows[0].total) - parseInt(categoriesResult.rows[0].active)
      },
      banners: {
        total: parseInt(bannersResult.rows[0].total),
        active: parseInt(bannersResult.rows[0].active),
        inactive: parseInt(bannersResult.rows[0].total) - parseInt(bannersResult.rows[0].active)
      },
      testimonials: {
        total: parseInt(testimonialsResult.rows[0].total),
        active: parseInt(testimonialsResult.rows[0].active),
        inactive: parseInt(testimonialsResult.rows[0].total) - parseInt(testimonialsResult.rows[0].active),
        averageRating: testimonialsResult.rows[0].avg_rating ? parseFloat(testimonialsResult.rows[0].avg_rating).toFixed(1) : '0'
      }
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', database: 'PostgreSQL' });
});

// ============ HOME CONTENT ROUTES ============
app.get('/api/home-content', async (req, res) => {
  try {
    const result = await query('SELECT * FROM home_content ORDER BY section_name ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get home content error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch home content', error: error.message });
  }
});

app.get('/api/home-content/:section', async (req, res) => {
  try {
    const result = await query('SELECT * FROM home_content WHERE section_name = $1', [req.params.section]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Home content section not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get home content section error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch home content section', error: error.message });
  }
});

app.post('/api/home-content', authenticateToken, bannerUpload.single('image'), async (req, res) => {
  try {
    const { section_name, title, subtitle, description, content, button_text, button_link, active } = req.body;
    const image = req.file ? `/uploads/banners/${req.file.filename}` : req.body.image;
    
    const existingSection = await query('SELECT id FROM home_content WHERE section_name = $1', [section_name]);
    
    let result;
    if (existingSection.rows.length > 0) {
      result = await query(
        `UPDATE home_content 
         SET title = COALESCE($1, title), 
             subtitle = COALESCE($2, subtitle), 
             description = COALESCE($3, description), 
             content = COALESCE($4, content), 
             image = COALESCE($5, image), 
             button_text = COALESCE($6, button_text), 
             button_link = COALESCE($7, button_link), 
             active = COALESCE($8, active),
             updated_at = CURRENT_TIMESTAMP
         WHERE section_name = $9 
         RETURNING *`,
        [title, subtitle, description, content, image, button_text, button_link, active !== 'false', section_name]
      );
    } else {
      result = await query(
        `INSERT INTO home_content (section_name, title, subtitle, description, content, image, button_text, button_link, active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [section_name, title, subtitle, description, content, image, button_text, button_link, active !== 'false']
      );
    }
    
    res.status(201).json({ success: true, message: 'Home content saved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create/update home content error:', error);
    res.status(500).json({ success: false, message: 'Failed to save home content', error: error.message });
  }
});

app.put('/api/home-content/:section', authenticateToken, bannerUpload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, description, content, button_text, button_link, active } = req.body;
    
    const existingSection = await query('SELECT * FROM home_content WHERE section_name = $1', [req.params.section]);
    if (existingSection.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Home content section not found' });
    }
    
    const image = req.file ? `/uploads/banners/${req.file.filename}` : (req.body.image || existingSection.rows[0].image);
    
    const result = await query(
      `UPDATE home_content 
       SET title = COALESCE($1, title), 
           subtitle = COALESCE($2, subtitle), 
           description = COALESCE($3, description), 
           content = COALESCE($4, content), 
           image = COALESCE($5, image), 
           button_text = COALESCE($6, button_text), 
           button_link = COALESCE($7, button_link), 
           active = COALESCE($8, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE section_name = $9 
       RETURNING *`,
      [title, subtitle, description, content, image, button_text, button_link, active !== 'false' && active !== false, req.params.section]
    );
    
    res.json({ success: true, message: 'Home content updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update home content error:', error);
    res.status(500).json({ success: false, message: 'Failed to update home content', error: error.message });
  }
});

app.delete('/api/home-content/:section', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM home_content WHERE section_name = $1 RETURNING *', [req.params.section]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Home content section not found' });
    }
    
    res.json({ success: true, message: 'Home content deleted successfully' });
  } catch (error) {
    console.error('Delete home content error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete home content', error: error.message });
  }
});


// ============ CONTACT MESSAGES ROUTES ============
app.get('/api/contact-messages', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contact messages', error: error.message });
  }
});

app.get('/api/contact-messages/unread/count', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) as unread_count FROM contact_messages WHERE read = false');
    res.json({ success: true, data: { unread_count: parseInt(result.rows[0].unread_count) } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
  }
});

app.get('/api/contact-messages/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM contact_messages WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contact message', error: error.message });
  }
});

app.post('/api/contact-messages', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    if (!name || !phone || !subject || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    const result = await query(
      `INSERT INTO contact_messages (name, email, phone, subject, message) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, email || '', phone, subject, message]
    );
    
    res.status(201).json({ success: true, message: 'Message received successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to save message', error: error.message });
  }
});

app.put('/api/contact-messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `UPDATE contact_messages 
       SET read = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    res.json({ success: true, message: 'Message marked as read', data: result.rows[0] });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message', error: error.message });
  }
});

app.delete('/api/contact-messages/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM contact_messages WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
  }
});


// ============ ORDERS ROUTES ============
// Generate unique order number
function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

// Get all orders (Admin)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = 'SELECT * FROM orders';
    const params = [];
    
    if (status) {
      queryText += ' WHERE order_status = $1';
      params.push(status);
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
});

// Get single order
app.get('/api/orders/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1 OR order_number = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order', error: error.message });
  }
});

// Create new order (Public)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      city,
      state,
      pincode,
      items,
      total_amount,
      notes
    } = req.body;
    
    // Validation
    if (!customer_name || !customer_phone || !delivery_address || !items || !total_amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: customer_name, customer_phone, delivery_address, items, total_amount' 
      });
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Items must be a non-empty array' 
      });
    }
    
    const order_number = generateOrderNumber();
    
    const result = await query(
      `INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone,
        delivery_address, city, state, pincode, items, total_amount,
        payment_method, order_status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        order_number,
        customer_name,
        customer_email || null,
        customer_phone,
        delivery_address,
        city || null,
        state || null,
        pincode || null,
        JSON.stringify(items),
        total_amount,
        'COD',
        'pending',
        notes || null
      ]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Order placed successfully', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
  }
});

// Update order status (Admin)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { order_status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(order_status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const result = await query(
      `UPDATE orders 
       SET order_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [order_status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order status updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status', error: error.message });
  }
});

// Delete order (Admin)
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete order', error: error.message });
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin API available at http://localhost:${PORT}/api`);
  console.log(`🗄️  Database: PostgreSQL`);
});
