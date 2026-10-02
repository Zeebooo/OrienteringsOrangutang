import { supabase } from '@/lib/supabase';

export async function fetchProfile(userId: string) {
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.single();

	if (error) {
		console.error('Error fetching profile:', error);
		return null;
	}

	return data;
}

export async function updateProfile(userId: string, name:string) {
	const trimmedName = name.trim();
	if (trimmedName.length < 1 || trimmedName.length > 25) {
		console.error('Name must be between 1 and 25 characters long.');
		return null;
	}

	const { data, error } = await supabase
		.from('profiles')
		.update({ name })
		.eq('id', userId)
		.single();

	if (error) {
		console.error('Error updating profile:', error);
		return null;
	}

	return data;
}