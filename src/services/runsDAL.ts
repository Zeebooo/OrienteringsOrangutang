import { supabase } from '@/lib/supabase';
import type { Coordinate } from '@/types'; // Antar att ni har Coordinate definierad i '@/types'

// ─── Typer ────────────────────────────────────────────────────────────────

export type RunState = 'started' | 'completed' | 'abandoned';

/** En rad i tabellen `runs`, med kolumnnamnen precis som i databasen. */
type RunRow = {
    id: string;
    user_id: string;
    map_id: string;
    elapsed_ms: number;
    visited_controls: Coordinate[];
    completed: boolean;
    state: RunState;
    created_at: string;
};

/** En run så som appen ser det. */
export type RunSummary = {
    id: string;
    userId: string;
    mapId: string;
    elapsedMs: number;
    visitedControls: Coordinate[];
    isCompleted: boolean;
    state: RunState;
    createdAt: Date;
};

// Kolumnerna i `runs`
const RUN_COLUMNS = 'id, user_id, map_id, elapsed_ms, visited_controls, completed, state, created_at';

// ─── Omvandling databas → app ─────────────────────────────────────────────

function toRun(row: RunRow): RunSummary {
    return {
        id: row.id,
        userId: row.user_id,
        mapId: row.map_id,
        elapsedMs: row.elapsed_ms,
        visitedControls: row.visited_controls || [],
        isCompleted: row.completed,
        state: row.state,
        createdAt: new Date(row.created_at),
    };
}

// ─── Läsa ─────────────────────────────────────────────────────────────────

/** Hämtar alla lopp för en specifik användare. Bra för profilsidan/historiken. */
export async function fetchUserRuns(userId: string): Promise<RunSummary[]> {
    const { data, error } = await supabase
        .from('runs')
        .select(RUN_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }); // Nyast först

    if (error) throw error;
    return data.map((row) => toRun(row as RunRow));
}

/** Hämtar ett specifikt, aktivt lopp för en användare och en karta. */
export async function fetchActiveRun(userId: string, mapId: string): Promise<RunSummary | null> {
    const { data, error } = await supabase
        .from('runs')
        .select(RUN_COLUMNS)
        .eq('user_id', userId)
        .eq('map_id', mapId)
        .eq('state', 'started')
        .maybeSingle(); // Kan finnas 0 eller 1 aktivt lopp

    if (error) throw error;
    return data ? toRun(data as RunRow) : null;
}


// ─── Skriva ───────────────────────────────────────────────────────────────

/** Startar ett nytt lopp för en användare på en specifik karta. */
export async function createRun(userId: string, mapId: string): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .insert({
            user_id: userId,
            map_id: mapId,
            state: 'started',
            completed: false,
            elapsed_ms: 0,
            visited_controls: []
        })
        .select(RUN_COLUMNS)
        .single();

    if (error) throw error;
    return toRun(data as RunRow);
}

/** 
 * Uppdaterar listan med besökta kontroller. 
 * Används när GPS:en registrerar att användaren har nått en kontroll. 
 */
export async function updateVisitedControls(runId: string, visitedControls: Coordinate[]): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .update({ visited_controls: visitedControls })
        .eq('id', runId)
        .select(RUN_COLUMNS)
        .single();

    if (error) throw error;
    return toRun(data as RunRow);
}

/** Avslutar loppet och sparar den slutgiltiga tiden. */
export async function completeRun(runId: string, elapsedMs: number, finalControls: Coordinate[]): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .update({
            state: 'completed',
            completed: true,
            elapsed_ms: elapsedMs,
            visited_controls: finalControls
        })
        .eq('id', runId)
        .select(RUN_COLUMNS)
        .single();

    if (error) throw error;
    return toRun(data as RunRow);
}

/** Avbryter ett lopp i förtid (om man t.ex. ger upp). */
export async function abandonRun(runId: string): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .update({
            state: 'abandoned',
            completed: false
        })
        .eq('id', runId)
        .select(RUN_COLUMNS)
        .single();

    if (error) throw error;
    return toRun(data as RunRow);
}