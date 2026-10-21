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

export async function updateProfile(userId: string, name: string) {
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 25) {
        console.error('Name must be between 1 and 25 characters long.');
        return null;
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({ name: trimmedName })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        return null;
    }

    return data;
}

// Ny funktion för att uppdatera användarens statistik i profilen
export async function incrementUserStats(userId: string, mapsToAdd: number, controlsToAdd: number, kmToAdd: number) {
    try {
        const profile = await fetchProfile(userId);
        if (!profile) return;

        const newMaps = (profile.maps_completed || 0) + mapsToAdd;
        const newControls = (profile.controls_taken || 0) + controlsToAdd;
        const newKm = (profile.km_walked || 0) + kmToAdd;

        const { error } = await supabase
            .from('profiles')
            .update({
                maps_completed: newMaps,
                controls_taken: newControls,
                km_walked: newKm,
            })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user stats:', error);
        }
    } catch (err) {
        console.error('Exception updating user stats:', err);
    }
}