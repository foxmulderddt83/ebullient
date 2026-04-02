import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';

export const useSupabaseAuthState = async (supabase, sessionId) => {
    const TABLE_NAME = 'whatsapp_sessions';

    // Helper to read data from Supabase
    const readData = async (key) => {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('data')
                .eq('session_id', sessionId)
                .eq('key', key)
                .single();

            if (error || !data) return null;
            return JSON.parse(data.data, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    // Helper to write data to Supabase
    const writeData = async (key, data) => {
        try {
            await supabase
                .from(TABLE_NAME)
                .upsert({
                    session_id: sessionId,
                    key: key,
                    data: JSON.stringify(data, BufferJSON.replacer),
                    updated_at: new Date().toISOString()
                });
        } catch (error) {
            console.error('Error writing session data:', error);
        }
    };

    // Helper to remove data from Supabase
    const removeData = async (key) => {
        try {
            await supabase
                .from(TABLE_NAME)
                .delete()
                .eq('session_id', sessionId)
                .eq('key', key);
        } catch (error) {
            console.error('Error removing session data:', error);
        }
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(key, value));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData('creds', creds)
    };
};
