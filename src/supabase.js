import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── WORKSPACE ────────────────────────────────────────────────────

export async function getOrCreateWorkspace(userId, name, email) {
  // Kullanıcının workspace'ini bul
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id, workspaces(*)')
    .eq('id', userId)
    .single()

  if (profile?.workspace_id) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', profile.workspace_id)
      .single()
    return ws
  }

  // Yeni workspace oluştur
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'-') + '-' + Date.now()
  const { data: ws } = await supabase
    .from('workspaces')
    .insert([{ name: name || email.split('@')[0] + ' Hukuk Bürosu', slug, owner_id: userId }])
    .select()
    .single()

  // Profile'a workspace_id ata
  if (ws) {
    await supabase.from('profiles').update({ workspace_id: ws.id }).eq('id', userId)
  }
  return ws
}

export async function updateWorkspace(id, updates) {
  const { data } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return data
}

// ─── GENERIC CRUD ─────────────────────────────────────────────────

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

// ─── ÖDEME TAKVİMİ ────────────────────────────────────────────────

export async function fetchPaymentSchedule(caseId) {
  const { data, error } = await supabase
    .from('payment_schedule')
    .select('*')
    .eq('case_id', caseId)
    .order('due_date', { ascending: true })
  if (error) { console.error(error); return [] }
  return data
}

export async function fetchAllPaymentSchedules() {
  const { data, error } = await supabase
    .from('payment_schedule')
    .select('*')
    .order('due_date', { ascending: true })
  if (error) { console.error(error); return [] }
  return data
}

// ─── DOSYA OKUMA ──────────────────────────────────────────────────

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
