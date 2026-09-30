import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		'Supabase saknar URL eller nyckel. Kontrollera .env och starta om `npx expo start`.',
	);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		storage: localStorage, // sparar inloggningen på telefonen (via expo-sqlite)
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false, // mobilappar har ingen URL att läsa inloggningen från
	},
});

// Förnya inloggningen bara när appen är öppen
AppState.addEventListener('change', (state) => {
	if (state === 'active') {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});
