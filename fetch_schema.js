import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://kjukdoqkunuifiorcdpz.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqdWtkb3FrdW51aWZpb3JjZHB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxMTk2NiwiZXhwIjoyMDg1ODg3OTY2fQ.I9uy5jSbeIcHldaYH0f_Lt3ooBo248MYeqH43vkUFeM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function getSchemas() {
    let mdContent = "# Supabase Database Schema Details\n\n";
    mdContent += `Generated on: ${new Date().toISOString()}\n\n`;

    try {
        // Since we can't query pg_catalog easily without an RPC, 
        // we'll use a standard SQL injection via a known RPC if it exists, 
        // or we try to use the 'rpc' to run a custom query if the user has one.
        // Most Supabase projects don't have a 'run_sql' RPC by default for security.
        
        // Let's try to get table names and column info using a more robust method
        // if we can't do that, we'll stick to the manual list but improve descriptions.
        
    const schemaGroups = [
        {
            name: 'public',
            tables: [
                { name: 'registrations', desc: 'Event registration data' },
                { name: 'events', desc: 'Specific event instances' },
                { name: 'event_profiles', desc: 'Reusable event templates' },
                { name: 'document_templates', desc: 'PDF/Word templates' },
                { name: 'activity_logs', desc: 'Admin audit trail' },
                { name: 'app_settings', desc: 'Global app config' },
                { name: 'business_hours', desc: 'Operating hours' },
                { name: 'email_configs', desc: 'SMTP and email settings' },
                { name: 'notification_logs', desc: 'Notification history' },
                { name: 'whatsapp_configs', desc: 'WhatsApp credentials' }
            ]
        },
        {
            name: 'auth',
            tables: [
                { name: 'users', desc: 'User accounts and authentication' },
                { name: 'identities', desc: 'External provider identities (Google, etc.)' },
                { name: 'sessions', desc: 'Active user sessions' }
            ]
        },
        {
            name: 'storage',
            tables: [
                { name: 'buckets', desc: 'Storage containers (media, docs, etc.)' },
                { name: 'objects', desc: 'Metadata for uploaded files' }
            ]
        }
    ];

    for (const group of schemaGroups) {
        mdContent += `# Schema: ${group.name.toUpperCase()}\n\n`;

        for (const table of group.tables) {
            mdContent += `## Table: ${table.name}\n`;
            mdContent += `**Description**: ${table.desc}\n\n`;
            
            const { data: colsData, error: colsErr } = await supabase
                .schema(group.name)
                .from(table.name)
                .select('*')
                .limit(1);
            
            if (colsData && colsData.length > 0) {
                const sample = colsData[0];
                mdContent += "### Columns (Detected):\n";
                mdContent += "| Column | Type |\n| --- | --- |\n";
                Object.keys(sample).forEach(key => {
                    let type = typeof sample[key];
                    if (sample[key] === null) type = "nullable";
                    mdContent += `| ${key} | ${type} |\n`;
                });
                mdContent += "\n";
            } else {
                mdContent += "### Columns: (No data found to infer structure)\n\n";
            }
            mdContent += "---\n\n";
        }
    }

        fs.writeFileSync('c:\\Games\\oneday-clone-main\\schemas.md', mdContent);
        console.log("Schema details written to schemas.md");

    } catch (e) {
        console.error("Error fetching schema:", e);
    }
}

getSchemas();
