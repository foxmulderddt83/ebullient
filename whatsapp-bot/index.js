import express from 'express';
import cors from 'cors';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { useSupabaseAuthState } from './supabase-auth.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Polyfill for globalThis.crypto for older Node versions/libraries
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Supabase Setup
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    });
    console.log('✅ Supabase client initialized');
    
    // Test connection
    supabase.from('site_settings').select('key').limit(1)
        .then(({ error }) => {
            if (error) console.error('❌ Supabase Connection Test Failed:', error.message);
            else console.log('✅ Supabase Connection Test Successful');
        });
} else {
    console.warn('⚠️ Supabase credentials missing (URL or Key). Queue processing will be disabled.');
    console.log('DEBUG: SUPABASE_URL present:', !!SUPABASE_URL);
    console.log('DEBUG: SUPABASE_KEY present:', !!SUPABASE_KEY);
}

// CORS - Allow Frontend
app.use(cors({
    origin: ['https://oneday-clone-main.vercel.app', 'https://onedaypilot.vercel.app', 'https://onedaypilot-clone.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let sock = null;
let isConnected = false;
let qrCode = null;
let heartbeatInterval;
let realtimeChannel = null;
let realtimeRetryTimeout = null;
let realtimeRetryDelay = 30000;

// Heartbeat logic to prevent multiple instances conflict
async function checkHeartbeat() {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'whatsapp_bot_heartbeat')
            .single();
            
        if (error || !data) return 0;
        return parseInt(data.value) || 0;
    } catch (e) {
        return 0;
    }
}

async function updateHeartbeat() {
    try {
        await supabase.from('site_settings').upsert({ 
            key: 'whatsapp_bot_heartbeat', 
            value: Date.now().toString() 
        });
    } catch (e) {
        console.error('Heartbeat update failed', e);
    }
}

// Initialize WhatsApp
async function connectToWhatsApp() {
    try {
        if (!supabase) {
            console.error('❌ Supabase client not initialized. Cannot store auth state.');
            return;
        }

        // Check for active instance before connecting
        const lastHeartbeat = await checkHeartbeat();
        const now = Date.now();
        // If another instance was active less than 60 seconds ago, wait.
        if (now - lastHeartbeat < 60000) { 
            console.log('⚠️ Another instance is active (heartbeat detected). Waiting...');
            setTimeout(connectToWhatsApp, 20000 + Math.floor(Math.random() * 10000));
            return;
        }

        const { state, saveCreds } = await useSupabaseAuthState(supabase, 'auth_info_baileys');
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['OneDayPilot', 'Chrome', '121.0.0.0'],
            connectTimeoutMs: 60000,
            syncFullHistory: false // optimize startup
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCode = qr;
                console.log('📱 QR Code updated');
                if (supabase) {
                    await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_qr', value: qr });
                    await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_status', value: 'disconnected' });
                }
            }
            
            if (connection === 'close') {
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                isConnected = false;
                qrCode = null;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log('❌ Connection closed');
                if (supabase) {
                    await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_status', value: 'disconnected' });
                }
                
                if (shouldReconnect) {
                    // Add random delay to prevent tight loops in case of multiple instances
                    const delay = Math.floor(Math.random() * 3000) + 3000; // 3-6 seconds
                    console.log(`🔄 Reconnecting in ${delay}ms...`);
                    setTimeout(connectToWhatsApp, delay);
                }
            } 
            
            if (connection === 'open') {
                isConnected = true;
                qrCode = null;
                console.log('✅ WhatsApp Connected!');
                
                // Start heartbeat
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                updateHeartbeat();
                heartbeatInterval = setInterval(updateHeartbeat, 30000); // 30s

                console.log('📱 Number:', sock.user?.id);
                if (supabase) {
                    await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_status', value: 'connected' });
                    await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_qr', value: '' });
                }
            }
        });
        
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.key.fromMe && msg.message) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                console.log(`📩 Message received: ${text}`);
            }
        });

    } catch (error) {
        console.error('❌ WhatsApp Connection Error:', error);
        setTimeout(connectToWhatsApp, 5000);
    }
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        connected: isConnected, 
        number: sock?.user?.id || null,
        service: 'Combined WhatsApp & PDF Bot'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Combined service is running' });
});

app.get('/api/qr', (req, res) => {
    if (isConnected) {
        return res.json({ connected: true, qr: null });
    }
    
    if (qrCode) {
        return res.json({ connected: false, qr: qrCode });
    }
    
    res.json({ connected: false, qr: null, message: 'Waiting for QR code...' });
});

// Proxy PDF generation and conversion requests to Python service on port 8081
app.all(['/api/generate-*path', '/api/convert-pdf-to-html', '/api/generated-documents/*path'], async (req, res) => {
    try {
        const pythonUrl = `http://127.0.0.1:8081${req.originalUrl}`;
        console.log(`🔀 Proxying ${req.method} request to: ${pythonUrl}`);
        
        const axiosConfig = {
            method: req.method,
            url: pythonUrl,
            data: req.body,
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/json'
            }
        };

        if (req.method === 'GET' && req.originalUrl.includes('generate')) {
            axiosConfig.responseType = 'stream';
        }

        const response = await axios(axiosConfig);
        
        // Forward headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        if (axiosConfig.responseType === 'stream') {
            response.data.pipe(res);
        } else {
            res.status(response.status).json(response.data);
        }
    } catch (error) {
        console.error('❌ Proxy Error:', error.message);
        
        // Don't try to stringify the whole error object, it may contain circular structures
        const status = error.response?.status || 500;
        
        // If the error response is a stream, we can't just pass it to res.json()
        let errorDetails = error.message;
        if (error.response?.data && typeof error.response.data.on === 'function') {
            // It's a stream, we can't easily get the data here without consuming it
            errorDetails = 'PDF Service Error (Stream Response)';
        } else if (error.response?.data) {
            errorDetails = error.response.data;
        }

        res.status(status).json({ 
            error: 'PDF Service Error', 
            details: errorDetails,
            path: req.originalUrl
        });
    }
});

app.post('/api/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!isConnected) {
            return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
        }
        
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Phone and message required' });
        }
        
        let cleanPhone = phone.replace(/[\s\-\+]/g, '');
        if (!cleanPhone.startsWith('60') && cleanPhone.length < 11) {
            cleanPhone = '60' + cleanPhone;
        }
        
        const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(chatId, { text: message });
        
        res.json({ success: true, message: 'Message sent', to: chatId });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { phone, message, mediaUrls } = req.body;
        
        if (!isConnected) {
            return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
        }
        
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Phone and message required' });
        }
        
        let cleanPhone = phone.replace(/[\s\-\+]/g, '');
        if (!cleanPhone.startsWith('60') && cleanPhone.length < 11) {
            cleanPhone = '60' + cleanPhone;
        }
        
        const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(chatId, { text: message });
        
        if (Array.isArray(mediaUrls)) {
            for (const url of mediaUrls) {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    const fileName = url.split('/').pop() || 'document.pdf';
                    await sock.sendMessage(chatId, { 
                        document: Buffer.from(response.data), 
                        mimetype: 'application/pdf', 
                        fileName: fileName
                    });
                } catch (pdfErr) {
                    console.error(`Error sending PDF ${url}:`, pdfErr.message);
                }
            }
        }
        
        res.json({ success: true, message: 'Message sent', to: chatId });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/test-reminder', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Supabase not initialized' });
        }
        if (!isConnected) {
            return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
        }

        const { bookingId } = req.body;
        if (!bookingId) {
            return res.status(400).json({ success: false, error: 'bookingId is required' });
        }

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*, customer:customers(*), booking_items(*, package:packages(*))')
            .or(`booking_id.eq.${bookingId},booking_reference.eq.${bookingId}`)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const message = `Reminder: your event is tomorrow.\n\n${formatBookingDetailsText(booking)}`;
        await sendWhatsAppFromBackend(booking, message, []);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/soft-reconnect', async (req, res) => {
    try {
        if (!isConnected) {
            connectToWhatsApp();
        }
        res.json({ success: true, message: 'Reconnection initiated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/reset-session', async (req, res) => {
    try {
        console.log('🔄 Resetting session requested...');
        
        // 1. Close existing connection
        if (sock) {
            try {
                sock.end(new Error('Resetting session'));
                sock = null;
            } catch (e) {
                console.error('Error closing socket:', e);
            }
        }
        
        // 2. Clear session data from Supabase
        if (supabase) {
            console.log('🧹 Clearing auth_info_baileys from Supabase...');
            const { error } = await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', 'auth_info_baileys');
                
            if (error) {
                console.error('Error clearing session:', error);
            }
        }
        
        // 3. Reset state
        isConnected = false;
        qrCode = null;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        // 4. Update status in DB
        if (supabase) {
            await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_status', value: 'disconnected' });
            await supabase.from('site_settings').upsert({ key: 'whatsapp_bot_qr', value: '' });
        }

        // 5. Start fresh connection
        setTimeout(connectToWhatsApp, 1000);
        
        res.json({ success: true, message: 'Session reset and restarting...' });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendLog = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendLog({ ts: Date.now(), message: 'Connected to Log Stream' });

    const interval = setInterval(() => {
        sendLog({ ts: Date.now(), type: 'heartbeat' });
    }, 30000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// Queue Processing logic
async function processQueue() {
    if (!supabase || !isConnected) return;

    try {
        const { data, error } = await supabase
            .from('notification_queue')
            .select('*')
            .eq('status', 'pending')
            .eq('type', 'whatsapp') // Only process WhatsApp messages
            .lt('attempts', 3)
            .limit(5);

        if (error) throw error;

        for (const notif of (data || [])) {
            try {
                if (!notif.phone) {
                    throw new Error("Phone number missing");
                }
                
                let cleanPhone = notif.phone.replace(/[\s\-\+]/g, '');
                if (!cleanPhone.startsWith('60') && cleanPhone.length < 11) {
                    cleanPhone = '60' + cleanPhone;
                }
                const chatId = `${cleanPhone}@s.whatsapp.net`;

                // Send text message
                await sock.sendMessage(chatId, { text: notif.message });

                // Send PDFs if exist
                if (notif.media_urls && Array.isArray(notif.media_urls)) {
                    for (const url of notif.media_urls) {
                        try {
                            const response = await axios.get(url, { responseType: 'arraybuffer' });
                            const fileName = url.split('/').pop() || 'document.pdf';
                            await sock.sendMessage(chatId, { 
                                document: Buffer.from(response.data), 
                                mimetype: 'application/pdf', 
                                fileName: fileName
                            });
                        } catch (pdfErr) {
                            console.error(`Error sending PDF ${url}:`, pdfErr.message);
                        }
                    }
                } else if (notif.pdf_url) {
                    // Legacy support
                    const response = await axios.get(notif.pdf_url, { responseType: 'arraybuffer' });
                    await sock.sendMessage(chatId, { 
                        document: Buffer.from(response.data), 
                        mimetype: 'application/pdf', 
                        fileName: 'document.pdf' 
                    });
                }

                await supabase.from('notification_queue')
                    .update({ status: 'sent', updated_at: new Date() })
                    .eq('id', notif.id);

            } catch (e) {
                console.error(`Error sending notif ${notif.id}:`, e);
                await supabase.from('notification_queue')
                    .update({ 
                        status: 'failed', 
                        attempts: (notif.attempts || 0) + 1,
                        updated_at: new Date(),
                        error_message: e.message || JSON.stringify(e)
                    })
                    .eq('id', notif.id);
            }
        }
    } catch (e) {
        console.error('Queue processing error:', e);
    }
}

// Automatic Notification Trigger (Realtime)
async function handleAutoNotification(bookingId) {
    if (!supabase) return;
    
    console.log(`🚀 Starting auto-notification process for booking: ${bookingId}`);

    try {
        // 1. Fetch Booking with full details
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*, customer:customers(*), booking_items(*, package:packages(*))')
            .eq('booking_id', bookingId)
            .single();

        if (bookingError || !booking) {
            console.error('❌ Error fetching booking for auto-notif:', bookingError);
            return;
        }

        // 2. Fetch Settings
        const { data: settingsData } = await supabase
            .from('site_settings')
            .select('key, value')
            .in('key', [
                'payment_success_document_type', 
                'payment_success_email_enabled',
                'payment_success_email_template', 
                'payment_success_whatsapp_enabled',
                'whatsapp_template_payment_success'
            ]);

        const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

        // 3. Generate PDFs via Python Service
        let pdfUrls = [];
        const rawDocType = settings['payment_success_document_type'];
        let docTypes = [];
        
        try {
            if (rawDocType && rawDocType.startsWith('[')) {
                docTypes = JSON.parse(rawDocType);
            } else if (rawDocType && rawDocType !== 'none') {
                docTypes = [rawDocType];
            }
        } catch (e) {
            console.error('Error parsing doc types:', e);
        }

        if (docTypes.length > 0) {
            for (const type of docTypes) {
                try {
                    console.log(`📄 Generating ${type} PDF for booking ${bookingId}...`);
                    // Call the local Python service proxy
                    const response = await axios.get(`http://127.0.0.1:8081/api/generate-pdf/${bookingId}/${type}`);
                    
                    // The Python service returns the file as a stream and ALSO uploads it to Supabase
                    // We need to find the latest generated document in Supabase Storage or the DB record
                    const { data: genDocs } = await supabase
                        .from('generated_documents')
                        .select('file_path')
                        .eq('booking_id', bookingId)
                        .eq('document_type', type)
                        .order('generated_at', { ascending: false })
                        .limit(1);
                    
                    if (genDocs && genDocs.length > 0) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('media')
                            .getPublicUrl(genDocs[0].file_path);
                        pdfUrls.push(publicUrl);
                    }
                } catch (e) {
                    console.error(`❌ PDF generation failed for ${type}:`, e.message);
                }
            }
        }

        // 4. Send Email via Brevo (Backend implementation)
        const emailEnabled = settings['payment_success_email_enabled'] === 'true';
        const emailTemplateId = settings['payment_success_email_template'];

        if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
            await sendEmailFromBackend(booking, emailTemplateId, pdfUrls);
        }

        // 5. Send WhatsApp directly
        const whatsappEnabled = settings['payment_success_whatsapp_enabled'] === 'enabled';
        const whatsappTemplate = settings['whatsapp_template_payment_success'];

        if (whatsappEnabled && whatsappTemplate && isConnected) {
            await sendWhatsAppFromBackend(booking, whatsappTemplate, pdfUrls);
        }

    } catch (error) {
        console.error('❌ Global error in handleAutoNotification:', error);
    }
}

async function sendEmailFromBackend(booking, templateId, pdfUrls) {
    try {
        const { data: template } = await supabase
            .from('message_settings')
            .select('*')
            .eq('id', templateId)
            .single();

        const { data: emailConfig } = await supabase
            .from('email_settings_mission')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();

        if (!template || !emailConfig) {
            console.error('Missing email template or config');
            return;
        }

        const apiKey = emailConfig.smtp_password;
        const senderEmail = emailConfig.from_email;
        const senderName = emailConfig.from_name || 'One Day Pilot';

        let subject = template.subject;
        let content = template.message_content;

        // Simple variable replacement
        const vars = {
            '{customer.name}': booking.customer?.name || '',
            '{customer.email}': booking.customer?.email || '',
            '{customer.phone}': booking.customer?.phone || '',
            '{booking.booking_reference}': booking.booking_reference || '',
            '{booking.reference}': booking.booking_reference || '',
            '{booking.total_amount}': `RM ${booking.total_amount || 0}`,
            '{booking.paid_amount}': `RM ${booking.paid_amount || 0}`,
            '{booking.deposit_amount}': `RM ${booking.deposit_amount || 0}`,
            '{booking.payment_type}': booking.payment_type || '',
            '{booking.amount_to_pay}': booking.payment_type === 'deposit' ? `RM ${booking.deposit_amount || 0}` : `RM ${booking.total_amount || 0}`,
            '{booking.flight_date}': booking.flight_date || '',
            '{booking.flight_time}': booking.flight_time || '',
            '{package.name}': booking.booking_items?.[0]?.package?.name || '',
            '{package.description}': booking.booking_items?.[0]?.package?.description || '',
            '{package.price}': `RM ${booking.booking_items?.[0]?.package?.price || 0}`,
            '{package.quantity}': booking.booking_items?.[0]?.quantity || '1',
            '{customer_name}': booking.customer?.name || '',
            '{customer_email}': booking.customer?.email || '',
            '{customer_phone}': booking.customer?.phone || '',
            '{booking_id}': booking.booking_reference || '',
            '{booking_reference}': booking.booking_reference || '',
            '{total_amount}': `RM ${booking.total_amount || 0}`,
            '{paid_amount}': `RM ${booking.paid_amount || 0}`,
            '{deposit_amount}': `RM ${booking.deposit_amount || 0}`,
            '{payment_type}': booking.payment_type || '',
            '{amount_to_pay}': booking.payment_type === 'deposit' ? `RM ${booking.deposit_amount || 0}` : `RM ${booking.total_amount || 0}`
        };

        Object.entries(vars).forEach(([k, v]) => {
            subject = subject.split(k).join(v);
            content = content.split(k).join(v);
        });

        const attachments = pdfUrls.map(url => ({
            url: url,
            name: url.split('/').pop()
        }));

        console.log(`[BREVO] 📧 Sending email to ${booking.customer.email}...`);
        console.log(`[BREVO] 📝 Template ID: ${templateId}, Attachments: ${attachments.length}`);

        const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: booking.customer.email, name: booking.customer.name }],
            subject: subject,
            htmlContent: content,
            attachment: attachments.length > 0 ? attachments : undefined,
            cc: template.cc_emails?.length > 0 ? template.cc_emails.map(e => ({ email: e })) : undefined
        }, {
            headers: { 'api-key': apiKey, 'content-type': 'application/json' }
        });

        console.log(`[BREVO] ✅ Email sent successfully! MessageID: ${response.data.messageId}`);
    } catch (e) {
        console.error('[BREVO] ❌ Error sending backend email:', e.response?.data || e.message);
    }
}

async function sendWhatsAppFromBackend(booking, templateMessage, pdfUrls) {
    try {
        let message = templateMessage;
        const vars = {
            '{customer.name}': booking.customer?.name || '',
            '{customer.phone}': booking.customer?.phone || '',
            '{booking.booking_reference}': booking.booking_reference || '',
            '{booking.reference}': booking.booking_reference || '',
            '{booking.total_amount}': `RM ${booking.total_amount || 0}`,
            '{booking.paid_amount}': `RM ${booking.paid_amount || 0}`,
            '{booking.deposit_amount}': `RM ${booking.deposit_amount || 0}`,
            '{booking.payment_type}': booking.payment_type || '',
            '{booking.amount_to_pay}': booking.payment_type === 'deposit' ? `RM ${booking.deposit_amount || 0}` : `RM ${booking.total_amount || 0}`,
            '{booking.flight_date}': booking.flight_date || '',
            '{booking.flight_time}': booking.flight_time || '',
            '{package.name}': booking.booking_items?.[0]?.package?.name || '',
            '{package.description}': booking.booking_items?.[0]?.package?.description || '',
            '{package.price}': `RM ${booking.booking_items?.[0]?.package?.price || 0}`,
            '{package.quantity}': booking.booking_items?.[0]?.quantity || '1',
            '{customer_name}': booking.customer?.name || '',
            '{customer_phone}': booking.customer?.phone || '',
            '{booking_id}': booking.booking_reference || '',
            '{booking_reference}': booking.booking_reference || '',
            '{total_amount}': `RM ${booking.total_amount || 0}`,
            '{paid_amount}': `RM ${booking.paid_amount || 0}`,
            '{deposit_amount}': `RM ${booking.deposit_amount || 0}`,
            '{payment_type}': booking.payment_type || '',
            '{amount_to_pay}': booking.payment_type === 'deposit' ? `RM ${booking.deposit_amount || 0}` : `RM ${booking.total_amount || 0}`
        };

        Object.entries(vars).forEach(([k, v]) => {
            message = message.split(k).join(v);
        });

        let cleanPhone = booking.customer.phone.replace(/[\s\-\+]/g, '');
        if (!cleanPhone.startsWith('60') && cleanPhone.length < 11) {
            cleanPhone = '60' + cleanPhone;
        }
        const chatId = `${cleanPhone}@s.whatsapp.net`;

        console.log(`[WHATSAPP] 📱 Sending message to ${cleanPhone}...`);
        await sock.sendMessage(chatId, { text: message });

        for (const url of pdfUrls) {
            console.log(`[WHATSAPP] 📄 Sending PDF attachment: ${url.split('/').pop()}`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            await sock.sendMessage(chatId, { 
                document: Buffer.from(response.data), 
                mimetype: 'application/pdf', 
                fileName: url.split('/').pop() || 'document.pdf'
            });
        }

        console.log(`[WHATSAPP] ✅ WhatsApp delivery complete for ${cleanPhone}`);
    } catch (e) {
        console.error('[WHATSAPP] ❌ Error sending backend WhatsApp:', e.message);
    }
}

function formatAmount(amount) {
    const value = Number(amount ?? 0);
    if (Number.isNaN(value)) {
        return 'RM 0.00';
    }
    return `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBookingDetailsText(booking) {
    const items = (booking.booking_items || [])
        .map((item) => {
            const name = item.package?.name || 'Package';
            const qty = item.quantity || 1;
            return `${name} x${qty}`;
        })
        .join('\n');

    const amountToPay = booking.payment_type === 'deposit' ? booking.deposit_amount : booking.total_amount;

    const lines = [
        `Booking Reference: ${booking.booking_reference || ''}`,
        `Name: ${booking.customer?.name || ''}`,
        `Phone: ${booking.customer?.phone || ''}`,
        `Date: ${booking.flight_date || ''}`,
        `Time: ${booking.flight_time || ''}`,
        `Payment Type: ${booking.payment_type || ''}`,
        `Amount: ${formatAmount(amountToPay)}`
    ];

    if (items) {
        lines.push(`Items:\n${items}`);
    }

    return lines.join('\n');
}

async function handleReminderNotifications() {
    if (!supabase) return;

    try {
        const { data: settingsData, error: settingsError } = await supabase
            .from('site_settings')
            .select('key, value')
            .in('key', [
                'reminder_enabled',
                'reminder_days_before',
                'reminder_email_enabled',
                'reminder_email_template',
                'reminder_whatsapp_enabled',
                'reminder_whatsapp_template',
                'payment_success_email_enabled',
                'payment_success_email_template',
                'whatsapp_template_payment_success'
            ]);

        if (settingsError) {
            console.error('Reminder settings fetch failed:', settingsError.message);
            return;
        }

        const settings = settingsData?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

        if (settings['reminder_enabled'] === 'false') {
            return;
        }

        const daysBefore = Number.parseInt(settings['reminder_days_before'] || '1', 10) || 1;
        const target = new Date();
        target.setDate(target.getDate() + daysBefore);
        const year = target.getFullYear();
        const month = String(target.getMonth() + 1).padStart(2, '0');
        const day = String(target.getDate()).padStart(2, '0');
        const targetDate = `${year}-${month}-${day}`;

        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('*, customer:customers(*), booking_items(*, package:packages(*))')
            .eq('flight_date', targetDate)
            .eq('status', 'confirmed');

        if (bookingsError) {
            console.error('Reminder bookings fetch failed:', bookingsError.message);
            return;
        }

        for (const booking of (bookings || [])) {
            const emailTemplateId = settings['reminder_email_template'] || settings['payment_success_email_template'];
            const emailEnabledSetting = settings['reminder_email_enabled'] ?? settings['payment_success_email_enabled'];
            const emailEnabled = emailEnabledSetting === 'true';

            if (emailEnabled && emailTemplateId && emailTemplateId !== 'none') {
                const { data: existingEmail } = await supabase
                    .from('notification_queue')
                    .select('id')
                    .eq('booking_id', booking.booking_id)
                    .eq('type', 'reminder_email')
                    .in('status', ['completed', 'sent'])
                    .limit(1);

                if (!existingEmail || existingEmail.length === 0) {
                    await sendEmailFromBackend(booking, emailTemplateId, []);
                    await supabase.from('notification_queue').insert({
                        type: 'reminder_email',
                        booking_id: booking.booking_id,
                        email: booking.customer?.email,
                        subject: 'Reminder',
                        message: `Template: ${emailTemplateId}`,
                        status: 'completed'
                    });
                }
            }

            const whatsappEnabledSetting = settings['reminder_whatsapp_enabled'] ?? 'enabled';
            const whatsappEnabled = whatsappEnabledSetting === 'enabled' || whatsappEnabledSetting === 'true';

            if (whatsappEnabled && isConnected) {
                const { data: existingWhatsapp } = await supabase
                    .from('notification_queue')
                    .select('id')
                    .eq('booking_id', booking.booking_id)
                    .eq('type', 'reminder_whatsapp')
                    .in('status', ['completed', 'sent'])
                    .limit(1);

                if (!existingWhatsapp || existingWhatsapp.length === 0) {
                    const message = `Reminder: your event is tomorrow.\n\n${formatBookingDetailsText(booking)}`;
                    await sendWhatsAppFromBackend(booking, message, []);
                    await supabase.from('notification_queue').insert({
                        type: 'reminder_whatsapp',
                        booking_id: booking.booking_id,
                        phone: booking.customer?.phone,
                        message: 'Reminder',
                        status: 'sent'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Reminder processing error:', error.message);
    }
}

// Realtime Listener
function setupRealtimeListener() {
    if (!supabase) return;

    console.log('📡 Setting up Supabase Realtime listener for bookings...');

    if (realtimeChannel) {
        try {
            supabase.removeChannel(realtimeChannel);
        } catch (e) {
            console.error('Realtime channel cleanup failed:', e.message);
        }
    }

    if (realtimeRetryTimeout) {
        clearTimeout(realtimeRetryTimeout);
        realtimeRetryTimeout = null;
    }

    realtimeChannel = supabase
        .channel('booking-updates')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'bookings'
            },
            async (payload) => {
                const booking = payload.new;
                const oldBooking = payload.old;

                // Trigger if status changed TO confirmed
                if (oldBooking.status !== 'confirmed' && booking.status === 'confirmed') {
                    console.log(`[REALTIME] 🔔 Booking ${booking.booking_id} confirmed! Triggering auto-notifications...`);
                    handleAutoNotification(booking.booking_id);
                } else {
                    console.log(`[REALTIME] ℹ️ Booking ${booking.booking_id} status update: ${oldBooking.status} -> ${booking.status} (No notification triggered)`);
                }
            }
        );

    realtimeChannel.subscribe((status, err) => {
        console.log(`[REALTIME] 📡 Subscription status: ${status}`);
        if (err) console.error(`[REALTIME] ❌ Subscription error:`, err.message);

        if (status === 'SUBSCRIBED') {
            realtimeRetryDelay = 30000;
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.log(`[REALTIME] ⏳ Retrying in ${Math.floor(realtimeRetryDelay / 1000)} seconds...`);
            const delay = realtimeRetryDelay;
            realtimeRetryDelay = Math.min(realtimeRetryDelay * 2, 300000);
            realtimeRetryTimeout = setTimeout(() => {
                setupRealtimeListener();
            }, delay);
        }
    });
}

// Global process error handling
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Run queue every 30 seconds
setInterval(processQueue, 30000);
setInterval(handleReminderNotifications, 3600000);

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    connectToWhatsApp();
    setupRealtimeListener();
    handleReminderNotifications();
});
