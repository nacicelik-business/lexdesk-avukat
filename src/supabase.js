import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export async function fetchAll(table) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(table, error); return [] }
  return data
}

export async function insertRow(table, row) {
  const { data, error } = await supabase
    .from(table)
    .insert([row])
    .select()
    .single()
  if (error) { console.error(table, error); return null }
  return data
}

export async function updateRow(table, id, updates) {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error(table, error); return null }
  return data
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) console.error(table, error)
}


