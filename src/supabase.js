import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export async function fetchAll(table) {
  const { data, error } = await supabase
    .from(table).select('*').order('created_at', { ascending: false })
  if (error) { console.error(table, error); return [] }
  return data
}

export async function insertRow(table, row) {
  const { data, error } = await supabase
    .from(table).insert([row]).select().single()
  if (error) { console.error(table, error); return null }
  return data
}

export async function updateRow(table, id, updates) {
  const { data, error } = await supabase
    .from(table).update(updates).eq('id', id).select().single()
  if (error) { console.error(table, error); return null }
  return data
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) console.error(table, error)
}

// ─── BELGE YÜKLEME ────────────────────────────────────────────────

export async function uploadDocument(caseId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${caseId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from('case-documents')
    .upload(path, file, { upsert: false })

  if (error) { console.error('Upload error:', error); return null }

  const { data } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(path, 86400)

  return { path, url: data?.signedUrl }
}

export async function getDocumentUrl(path) {
  const { data } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(path, 3600)
  return data?.signedUrl
}

export async function deleteDocument(path) {
  await supabase.storage.from('case-documents').remove([path])
}

export async function fetchDocuments(caseId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data
}

export async function extractTextFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      reader.onload = (e) => resolve({ type: 'pdf', data: e.target.result })
      reader.readAsDataURL(file)
    } else {
      reader.onload = (e) => resolve({ type: 'text', data: e.target.result })
      reader.readAsText(file)
    }
  })
}

