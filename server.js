import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { getSetting, setSetting, verifyUser } from './database.js';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'coquicult-super-secret-key-2026';

// Middleware
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await verifyUser(username, password);
        if (user) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.cookie('adminToken', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

app.get('/api/auth/check', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// --- SETTINGS ROUTES ---
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const email = await getSetting('adminEmail') || '';
        const stripeKey = await getSetting('stripeSecretKey');
        const gmailPassword = await getSetting('gmailPassword');
        
        res.json({ 
            email,
            isStripeConnected: !!stripeKey,
            hasGmailPassword: !!gmailPassword
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
    const { adminEmail, stripeSecretKey, gmailPassword } = req.body;
    try {
        if (adminEmail !== undefined) await setSetting('adminEmail', adminEmail);
        if (stripeSecretKey !== undefined && stripeSecretKey.trim() !== '') {
            await setSetting('stripeSecretKey', stripeSecretKey);
        }
        if (gmailPassword !== undefined && gmailPassword.trim() !== '') {
            await setSetting('gmailPassword', gmailPassword);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- CHECKOUT ROUTES ---
app.post('/api/checkout/create-session', async (req, res) => {
    const { cart } = req.body;
    
    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    try {
        const stripeSecretKey = await getSetting('stripeSecretKey');
        if (!stripeSecretKey) {
            return res.status(500).json({ error: 'Stripe is not configured by the admin yet.' });
        }
        
        const stripe = new Stripe(stripeSecretKey);
        
        const lineItems = cart.map(item => {
            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        description: item.customizations,
                    },
                    unit_amount: Math.round(item.price * 100), // convert dollars to cents
                },
                quantity: 1,
            };
        });

        // The origin will be passed from the frontend to return safely
        const origin = req.headers.origin || 'http://localhost:5173';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: \`\${origin}/success.html\`,
            cancel_url: \`\${origin}/menu.html\`,
            metadata: {
                cartInfo: JSON.stringify(cart.map(i => \`\${i.name} (\${i.customizations})\`))
            }
        });

        res.json({ url: session.url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- STRIPE WEBHOOK ---
app.post('/api/webhook', async (req, res) => {
    let event;
    try {
        event = JSON.parse(req.body.toString());
    } catch (err) {
        return res.status(400).send(\`Webhook Error: \${err.message}\`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(\`Payment successful for session \${session.id}\`);
        
        // Send email
        const adminEmail = await getSetting('adminEmail');
        const gmailAppPassword = await getSetting('gmailPassword');
        
        if (adminEmail && gmailAppPassword) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: adminEmail,
                    pass: gmailAppPassword
                }
            });
            
            let itemsText = "No items detailed found in metadata.";
            if (session.metadata && session.metadata.cartInfo) {
                try {
                    const parsed = JSON.parse(session.metadata.cartInfo);
                    itemsText = parsed.join('\\n');
                } catch(e) {}
            }

            const mailOptions = {
                from: adminEmail,
                to: adminEmail,
                subject: 'New Order - Coqui Cult Coffee',
                text: \`You have received a new order!\\n\\nDetails:\\nAmount: $\${(session.amount_total / 100).toFixed(2)}\\n\\nItems:\\n\${itemsText}\\n\\nPlease prepare the order for pickup in Philadelphia, PA.\`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email:', error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        } else {
            console.log('Skipping email notification - Admin email or app password not configured.');
        }
    }

    res.json({received: true});
});

app.listen(PORT, () => {
    console.log(\`Backend server running on http://localhost:\${PORT}\`);
});
