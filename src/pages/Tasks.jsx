// Tasks.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

const PRIORITIES = [
  { value: 'low', label: 'Low', badge: 'bg-fill text-label2', chip: 'bg-accent text-white' },
  { value: 'medium', label: 'Medium', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', chip: 'bg-amber-500 text-white' },
  { value: 'high', label: 'High', badge: 'bg-red-500/15 text-red-500', chip: 'bg-red-500 text-white' },
]

const priorityMeta = value => PRIORITIES.find(p => p.value === value) || PRIORITIES[1]

const formatDueDate = dateStr => {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const isOverdue = dateStr => {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d) < today
}

const nameFor = p => (p?.first_name || p?.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Someone')

export default function Tasks({ org, profile }) {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assigneeIds, setAssigneeIds] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = profile?.role === 'admin'

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, task_assignees(id, profile_id, completed, completed_at, profiles(first_name, last_name))')
      .eq('org_id', org.id)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setTasks(data)
  }

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', org.id)
      .order('first_name')
    if (data) setMembers(data)
  }

  useEffect(() => {
    if (org) {
      fetchTasks()
      if (isAdmin) fetchMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org])

  const openAddModal = () => {
    setEditingTask(null)
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('medium')
    setAssigneeIds([profile.id])
    setError('')
    setModalOpen(true)
  }

  const openEditModal = task => {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setDueDate(task.due_date || '')
    setPriority(task.priority)
    setAssigneeIds(task.task_assignees.map(a => a.profile_id))
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingTask(null)
  }

  const toggleAssignee = id => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    setError('')
    if (!title.trim()) {
      setError('Task title is required.')
      return
    }
    const targetIds = isAdmin ? assigneeIds : [profile.id]
    if (targetIds.length === 0) {
      setError('Assign this task to at least one person.')
      return
    }

    setLoading(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      priority,
    }

    let taskId = editingTask?.id
    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, org_id: org.id, created_by: profile.id })
        .select()
        .single()
      if (error) { setError(error.message); setLoading(false); return }
      taskId = data.id
    }

    const existingIds = editingTask ? editingTask.task_assignees.map(a => a.profile_id) : []
    const toAdd = targetIds.filter(id => !existingIds.includes(id))
    const toRemove = existingIds.filter(id => !targetIds.includes(id))

    if (toAdd.length > 0) {
      await supabase.from('task_assignees').insert(toAdd.map(profile_id => ({ task_id: taskId, profile_id })))
    }
    if (toRemove.length > 0) {
      await supabase.from('task_assignees').delete().eq('task_id', taskId).in('profile_id', toRemove)
    }

    closeModal()
    fetchTasks()
    setLoading(false)
  }

  const handleDelete = async taskId => {
    if (!window.confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchTasks()
  }

  const handleToggleComplete = async task => {
    const mine = task.task_assignees.find(a => a.profile_id === profile.id)
    if (!mine) return
    const nextCompleted = !mine.completed
    await supabase
      .from('task_assignees')
      .update({ completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null })
      .eq('task_id', task.id)
      .eq('profile_id', profile.id)
    fetchTasks()
  }

  const myTasks = tasks.filter(t => t.task_assignees.some(a => a.profile_id === profile.id))
  const assignedByMe = isAdmin
    ? tasks.filter(t => t.created_by === profile.id && t.task_assignees.some(a => a.profile_id !== profile.id))
    : []

  const canManage = task => task.created_by === profile.id || isAdmin

  return (
    <div className="flex flex-col gap-8">

      {/* ── My Tasks ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Tasks</h2>
            <p className="text-label2 text-[14px] mt-1">Your to-dos and anything assigned to you</p>
          </div>
          <button
            onClick={openAddModal}
            className="h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
          >
            + Add Task
          </button>
        </div>

        {myTasks.length === 0 ? (
          <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-12 text-center">
            <p className="text-label2 text-[15px]">No tasks yet.</p>
            <button
              onClick={openAddModal}
              className="mt-4 h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
            >
              Add your first task
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myTasks.map(task => {
              const mine = task.task_assignees.find(a => a.profile_id === profile.id)
              const completed = mine?.completed
              const overdue = !completed && isOverdue(task.due_date)
              const pMeta = priorityMeta(task.priority)
              return (
                <div key={task.id} className="bg-surface border border-sep rounded-[16px] shadow-ios p-4 flex gap-3">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`w-[22px] h-[22px] mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      completed ? 'bg-accent border-accent' : 'border-sep hover:border-accent'
                    }`}
                  >
                    {completed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className={`text-label font-semibold text-[15px] tracking-[-0.01em] truncate ${completed ? 'line-through text-label3' : ''}`}>
                          {task.title}
                        </h3>
                        <span className={`shrink-0 inline-block px-[7px] py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.05em] ${pMeta.badge}`}>
                          {pMeta.label}
                        </span>
                      </div>
                      {canManage(task) && (
                        <div className="flex gap-3 shrink-0">
                          <button onClick={() => openEditModal(task)} className="text-label2 hover:text-accent text-[12.5px] font-medium transition-colors">Edit</button>
                          <button onClick={() => handleDelete(task.id)} className="text-label2 hover:text-red-500 text-[12.5px] font-medium transition-colors">Delete</button>
                        </div>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-[13px] text-label2 mt-1 truncate">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className={`text-[12px] mt-1 ${overdue ? 'text-red-500 font-medium' : 'text-label3'}`}>
                        Due {formatDueDate(task.due_date)}{overdue ? ' · overdue' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Assigned by Me — admin only ── */}
      {isAdmin && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Assigned by Me</h2>
            <p className="text-label2 text-[14px] mt-1">Tasks you've handed to your team</p>
          </div>

          {assignedByMe.length === 0 ? (
            <p className="text-label3 text-[13px] pl-1">You haven't assigned anything to your team yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {assignedByMe.map(task => {
                const doneCount = task.task_assignees.filter(a => a.completed).length
                const total = task.task_assignees.length
                const pMeta = priorityMeta(task.priority)
                return (
                  <div key={task.id} className="bg-surface border border-sep rounded-[16px] shadow-ios p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-label font-semibold text-[15px] tracking-[-0.01em] truncate">{task.title}</h3>
                        <span className={`shrink-0 inline-block px-[7px] py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.05em] ${pMeta.badge}`}>
                          {pMeta.label}
                        </span>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => openEditModal(task)} className="text-label2 hover:text-accent text-[12.5px] font-medium transition-colors">Edit</button>
                        <button onClick={() => handleDelete(task.id)} className="text-label2 hover:text-red-500 text-[12.5px] font-medium transition-colors">Delete</button>
                      </div>
                    </div>
                    {task.description && <p className="text-[13px] text-label2 truncate">{task.description}</p>}
                    {task.due_date && <p className="text-[12px] text-label3">Due {formatDueDate(task.due_date)}</p>}
                    <div className="border-t border-sep pt-3 flex flex-col gap-1.5">
                      <p className="text-label3 text-[11px] font-semibold uppercase tracking-[0.07em]">{doneCount} of {total} done</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {task.task_assignees.map(a => (
                          <span key={a.id} className={`text-[12.5px] ${a.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-label2'}`}>
                            {a.completed ? '✓ ' : '· '}{nameFor(a.profiles)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50 p-6 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-bg rounded-[22px] shadow-sheet w-full max-w-[440px] max-h-[88vh] overflow-y-auto animate-sheet-in"
          >
            <div className="sticky top-0 z-10 bg-bg border-b border-sep flex items-center justify-between px-[18px] pt-4 pb-3">
              <button onClick={closeModal} className="text-accent text-[15.5px]">Cancel</button>
              <h3 className="text-label text-[16px] font-semibold tracking-[-0.02em]">
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h3>
              <button
                onClick={handleSave}
                disabled={loading}
                className="text-accent text-[15.5px] font-semibold disabled:opacity-40"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="p-[18px] flex flex-col gap-5">

              <div>
                <label className={fieldLabelClass}>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Restock supplies" />
              </div>

              <div>
                <label className={fieldLabelClass}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  className={`${fieldClass} resize-none`}
                  rows={2}
                  placeholder="Any additional detail..." />
              </div>

              <div>
                <label className={fieldLabelClass}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className={fieldClass} />
              </div>

              <div>
                <label className={fieldLabelClass}>Priority</label>
                <div className="flex flex-wrap gap-[7px]">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={`h-8 px-3.5 rounded-[9px] text-[13.5px] font-medium transition-colors ${
                        priority === p.value ? p.chip : 'bg-fill text-label2 hover:text-label'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin ? (
                <div>
                  <label className={fieldLabelClass}>Assign To</label>
                  {members.length === 0 ? (
                    <p className="text-label3 text-[13px] pl-1">No team members yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-[7px]">
                      {members.map(member => (
                        <button
                          key={member.id}
                          onClick={() => toggleAssignee(member.id)}
                          className={`h-8 px-3.5 rounded-[9px] text-[13.5px] font-medium transition-colors ${
                            assigneeIds.includes(member.id) ? 'bg-accent text-white' : 'bg-fill text-label2 hover:text-label'
                          }`}
                        >
                          {member.id === profile.id ? 'You' : nameFor(member)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-label3 text-[12.5px] pl-1">This task will be assigned to you.</p>
              )}

              {error && <p className="text-red-500 text-[13px] px-1">{error}</p>}

              {editingTask && canManage(editingTask) && (
                <button
                  onClick={() => { closeModal(); handleDelete(editingTask.id) }}
                  className="h-11 bg-red-500/15 hover:bg-red-500/25 text-red-500 rounded-[13px] text-[14.5px] font-semibold transition-colors"
                >
                  Delete Task
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
