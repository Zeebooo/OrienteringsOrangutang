import { supabase } from '@/lib/supabase';
import type { Coordinate } from '@/types';

export type RunState = 'started' | 'completed';

type RunRow = {
    id: string;
    user_id: string;
    map_id: string;
    elapsed_ms: number;
    visited_controls: Coordinate[];
    completed: boolean;
};

export type RunSummary = {
    id: string;
    userId: string;
    mapId: string;
    elapsedMs: number;
    visitedControls: Coordinate[];
    isCompleted: boolean;
    state: RunState;
};

// Vi hämtar bara de exakta kolumnerna som syns i din skiss
const RUN_COLUMNS = 'id, user_id, map_id, elapsed_ms, visited_controls, completed';

function toRun(row: RunRow): RunSummary {
    return {
        id: row.id,
        userId: row.user_id,
        mapId: row.map_id,
        elapsedMs: row.elapsed_ms,
        visitedControls: row.visited_controls || [],
        isCompleted: row.completed,
        state: row.completed ? 'completed' : 'started', 
    };
}

export async function fetchUserRuns(userId: string): Promise<RunSummary[]> {
    const { data, error } = await supabase
        .from('runs')
        .select(RUN_COLUMNS)
        .eq('user_id', userId);

    if (error) throw error;
    return data.map((row) => toRun(row as RunRow));
}

export async function fetchActiveRun(userId: string, mapId: string): Promise<RunSummary | null> {
    const { data, error } = await supabase
        .from('runs')
        .select(RUN_COLUMNS)
        .eq('user_id', userId)
        .eq('map_id', mapId)
        .eq('completed', false)
        .maybeSingle(); 

    if (error) throw error;
    return data ? toRun(data as RunRow) : null;
}

export async function createRun(userId: string, mapId: string): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .insert({
            user_id: userId,
            map_id: mapId,
            completed: false,
            elapsed_ms: 0,
            visited_controls: []
        })
        .select(RUN_COLUMNS)
        .single();

    if (error) throw error;
    return toRun(data as RunRow);
}

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

export async function completeRun(runId: string, elapsedMs: number, finalControls: Coordinate[]): Promise<RunSummary> {
    const { data, error } = await supabase
        .from('runs')
        .update({
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

export async function abandonRun(runId: string): Promise<void> {
    const { error } = await supabase
        .from('runs')
        .delete()
        .eq('id', runId);

    if (error) throw error;
}

export async function updateRunTime(runId: string, elapsedMs: number): Promise<void> {
    const { error } = await supabase
        .from('runs')
        .update({ elapsed_ms: elapsedMs })
        .eq('id', runId);

    if (error) throw error;
}