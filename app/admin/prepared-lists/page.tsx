'use client';

import React, { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/common/Navbar';
import Sidebar from '@/components/common/Sidebar';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import adminService from '@/services/admin.service';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Scale,
  ArrowLeftRight,
} from 'lucide-react';

interface PreparedListFile {
  filename: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

interface CompareStats {
  total_in_list: number;
  unique_in_list: number;
  duplicate_matrics: number;
  total_portal_scoped: number;
  prepared_on_portal: number;
  coverage_percentage: number;
  not_prepared_count: number;
  in_list_not_on_portal: number;
  changed_on_portal?: number;
}

interface ChangedStudent {
  matric_no: string;
  full_name: string;
  session_id?: number | string;
  updated_at?: string;
  changes: Record<string, { old: string; new: string }>;
}

const CHANGE_FIELD_LABELS: Record<string, string> = {
  fname: 'First Name',
  mname: 'Middle Name',
  lname: 'Surname',
  dob: 'Date of Birth',
  gender: 'Gender',
  marital_status: 'Marital Status',
  jamb_no: 'JAMB Reg No',
};

interface PreviewRow {
  matric_no: string;
  full_name?: string;
  name?: string;
  class_of_degree?: string | null;
}

interface SessionOption {
  id: number;
  name: string;
  is_active?: boolean;
}

const PreparedListsPage = () => {
  const { userType, hasPermission, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<PreparedListFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [stats, setStats] = useState<CompareStats | null>(null);
  const [notPreparedPreview, setNotPreparedPreview] = useState<PreviewRow[]>([]);
  const [missingPreview, setMissingPreview] = useState<PreviewRow[]>([]);
  const [changedPreview, setChangedPreview] = useState<ChangedStudent[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && (userType !== 'admin' || !hasPermission('canDownloadData'))) {
      router.push('/login');
    }
  }, [authLoading, userType, hasPermission, router]);

  // Sessions (default to the admin's selected/active session)
  useEffect(() => {
    if (authLoading || userType !== 'admin') return;
    const stored = localStorage.getItem('admin_selected_session_id');
    if (stored) setSessionId(stored);
    adminService.getSessions()
      .then((res) => {
        const list: SessionOption[] = res?.sessions || [];
        setSessions(list);
        if (!stored) {
          const active = list.find((s) => s.is_active) || list[0];
          if (active) setSessionId(String(active.id));
        }
      })
      .catch(console.error);
  }, [authLoading, userType]);

  const fetchFiles = async () => {
    try {
      const res = await adminService.getPreparedLists();
      setFiles(res.files || []);
      if (!selectedFile && res.files?.length) {
        setSelectedFile(res.files[0].filename);
      }
    } catch {
      toast.error('Failed to load prepared lists');
    }
  };

  useEffect(() => {
    if (authLoading || userType !== 'admin') return;
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userType]);

  const persistSession = (id: string) => {
    setSessionId(id);
    if (id) localStorage.setItem('admin_selected_session_id', id);
  };

  const dateWindowParams = (): Record<string, string> => ({
    ...(updatedFrom ? { updated_from: updatedFrom } : {}),
    ...(updatedTo ? { updated_to: updatedTo } : {}),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await adminService.uploadPreparedList(file);
      toast.success(`Uploaded "${file.name}"`);
      await fetchFiles();
      if (res?.file?.filename) setSelectedFile(res.file.filename);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete prepared list "${filename}"? This cannot be undone.`)) return;
    try {
      await adminService.deletePreparedList(filename);
      toast.success('Deleted');
      if (selectedFile === filename) {
        setSelectedFile('');
        setStats(null);
        setNotPreparedPreview([]);
        setMissingPreview([]);
        setChangedPreview([]);
      }
      await fetchFiles();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleCompare = async () => {
    if (!selectedFile) {
      toast.error('Select a prepared list first');
      return;
    }
    setIsComparing(true);
    try {
      const res = await adminService.comparePreparedList(selectedFile, sessionId, dateWindowParams());
      setStats(res.stats);
      setNotPreparedPreview(res.not_prepared_preview || []);
      setMissingPreview(res.missing_on_portal_preview || []);
      setChangedPreview(res.changed_preview || []);
      toast.success('Comparison complete');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  const handleExport = async (kind: 'prepared' | 'not-prepared' | 'changed') => {
    if (!selectedFile) {
      toast.error('Select a prepared list first');
      return;
    }
    try {
      const blob = await adminService.exportPreparedList(kind, selectedFile, sessionId, dateWindowParams());
      saveAs(blob, `${kind}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
      toast.success('Download started');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed');
    }
  };

  if (authLoading || (userType !== 'admin' && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" text="Loading..." />
      </div>
    );
  }

  return (
    <ProtectedRoute userType="admin">
      <div className="min-h-screen bg-background">
        <Navbar />
        <Sidebar />
        <div className="flex">
          <main className="flex-1 min-w-0 ml-0 md:ml-64 p-4 md:p-8 pt-28 md:pt-32 pb-24 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <Scale className="h-6 w-6 text-indigo-600" />
                  Prepared Lists
                </h1>
                <p className="text-muted-foreground mt-1">
                  Upload an Excel list of prepared students and compare it with the portal by matric number.
                  Files are stored only — nothing is written to the database.
                </p>
              </div>

              {/* Session + updated-at window selector */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 sm:items-end">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Session</label>
                      <select
                        value={sessionId}
                        onChange={(e) => persistSession(e.target.value)}
                        className="mt-1 w-full bg-white border border-gray-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 shadow-sm"
                      >
                        <option value="">All Sessions</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Updated from</label>
                      <input
                        type="date"
                        value={updatedFrom}
                        onChange={(e) => setUpdatedFrom(e.target.value)}
                        className="mt-1 w-full bg-white border border-gray-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Updated to</label>
                      <input
                        type="date"
                        value={updatedTo}
                        onChange={(e) => setUpdatedTo(e.target.value)}
                        className="mt-1 w-full bg-white border border-gray-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 shadow-sm"
                      />
                    </div>
                    <Button onClick={handleCompare} disabled={isComparing || !selectedFile} className="w-full lg:w-auto">
                      {isComparing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                      {isComparing ? 'Comparing...' : 'Run Comparison'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: pick “All Sessions” plus an updated-from date to catch every student who edited their
                    details since then — even if their record now sits in a different session.
                  </p>
                </CardContent>
              </Card>

              {/* Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Prepared List
                  </CardTitle>
                  <CardDescription>
                    Accepts .xlsx, .xls or .csv. Expected columns: MatricNo, FirstName, Middlename, Surname, GSMNo,
                    StateOfOrigin, ClassOfDegree, DateOfBirth, DateOfGraduation, Status, Gender, MaritalStatus,
                    JambRegNo, IsMilitary, CourseOfStudy, StudyMode.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleUpload}
                      disabled={isUploading}
                      className="flex-1 text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {isUploading && <LoadingSpinner size="sm" text="" />}
                  </div>

                  {/* Stored files */}
                  <div className="mt-4 space-y-2">
                    {files.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No prepared lists uploaded yet.</p>
                    ) : (
                      files.map((f) => (
                        <div
                          key={f.filename}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border ${
                            selectedFile === f.filename ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
                          }`}
                        >
                          <label className="flex items-start sm:items-center gap-2 cursor-pointer min-w-0">
                            <input
                              type="radio"
                              name="prepared_file"
                              checked={selectedFile === f.filename}
                              onChange={() => setSelectedFile(f.filename)}
                              className="mt-1 sm:mt-0"
                            />
                            <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium truncate">{f.filename}</span>
                              <span className="block text-xs text-muted-foreground">
                                {f.size_human} · {f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : ''}
                              </span>
                            </span>
                          </label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(f.filename)}
                            className="text-red-600 hover:text-red-700 w-full sm:w-auto"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              {stats && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">In List</p>
                            <p className="text-2xl font-bold">{stats.total_in_list}</p>
                            <p className="text-xs text-muted-foreground">{stats.unique_in_list} unique{stats.duplicate_matrics > 0 && ` · ${stats.duplicate_matrics} dup`}</p>
                          </div>
                          <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200 bg-green-50/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Prepared ✓</p>
                            <p className="text-2xl font-bold text-green-700">{stats.prepared_on_portal}</p>
                            <p className="text-xs text-muted-foreground">{stats.coverage_percentage}% of list on portal</p>
                          </div>
                          <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Not Prepared ✗</p>
                            <p className="text-2xl font-bold text-red-700">{stats.not_prepared_count}</p>
                            <p className="text-xs text-muted-foreground">on portal ({stats.total_portal_scoped} scoped)</p>
                          </div>
                          <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Missing on Portal</p>
                            <p className="text-2xl font-bold text-amber-700">{stats.in_list_not_on_portal}</p>
                            <p className="text-xs text-muted-foreground">in list, no student_nysc row</p>
                          </div>
                          <HelpCircle className="h-8 w-8 text-amber-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-indigo-200 bg-indigo-50/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Updated After List</p>
                            <p className="text-2xl font-bold text-indigo-700">{stats.changed_on_portal ?? 0}</p>
                            <p className="text-xs text-muted-foreground">portal data differs from list</p>
                          </div>
                          <ArrowLeftRight className="h-8 w-8 text-indigo-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Downloads */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Still To Prepare</CardTitle>
                        <CardDescription>
                          Portal students not found in the list — standard 16-column format.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button onClick={() => handleExport('not-prepared')} className="w-full bg-red-600 hover:bg-red-700">
                          <Download className="mr-2 h-4 w-4" />
                          Download Not Prepared ({stats.not_prepared_count})
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Prepared List Copy</CardTitle>
                        <CardDescription>Your original rows, verbatim.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button onClick={() => handleExport('prepared')} variant="outline" className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          Download Prepared ({stats.total_in_list})
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="border-indigo-200">
                      <CardHeader>
                        <CardTitle className="text-base">Updated After List</CardTitle>
                        <CardDescription>
                          Students whose names, DOB, gender, marital status or JAMB no. now differ from the list —
                          old vs new side by side.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button onClick={() => handleExport('changed')} className="w-full bg-indigo-600 hover:bg-indigo-700">
                          <Download className="mr-2 h-4 w-4" />
                          Download Updated ({stats.changed_on_portal ?? 0})
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Previews */}
                  {missingPreview.length > 0 && (
                    <Alert className="border-amber-200 bg-amber-50">
                      <HelpCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        <p className="font-medium text-amber-800 mb-2">
                          In list but NOT on portal (typos/stale entries?) — first {Math.min(100, missingPreview.length)}:
                        </p>
                        <div className="max-h-48 overflow-y-auto">
                          <ul className="text-sm text-amber-900 space-y-1">
                            {missingPreview.map((r, i) => (
                              <li key={i}>
                                <Badge variant="outline" className="mr-2">{r.matric_no}</Badge>{r.name || '—'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {notPreparedPreview.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Not Prepared Preview</CardTitle>
                        <CardDescription>First {notPreparedPreview.length} of {stats.not_prepared_count}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto max-h-72">
                          <table className="min-w-full text-sm divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Matric No</th>
                                <th className="px-3 py-2 text-left font-medium">Name</th>
                                <th className="px-3 py-2 text-left font-medium">Class of Degree</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {notPreparedPreview.map((r, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.matric_no}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{r.full_name}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">
                                    {r.class_of_degree ? r.class_of_degree : <span className="italic text-gray-400">NULL</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {changedPreview.length > 0 && (
                    <Alert className="border-indigo-200 bg-indigo-50">
                      <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
                      <AlertDescription>
                        <p className="font-medium text-indigo-800 mb-2">
                          Updated after list (old → new) — first {Math.min(100, changedPreview.length)} of {stats.changed_on_portal ?? 0}:
                        </p>
                        <div className="max-h-64 overflow-y-auto">
                          <ul className="text-sm text-indigo-900 space-y-1.5">
                            {changedPreview.map((r, i) => (
                              <li key={i}>
                                <Badge variant="outline" className="mr-2">{r.matric_no}</Badge>
                                {r.updated_at && (
                                  <span className="text-xs text-indigo-500 mr-2">({r.updated_at})</span>
                                )}
                                {Object.entries(r.changes).map(([field, change]) => (
                                  <span key={field} className="mr-3 whitespace-nowrap">
                                    <span className="text-xs font-medium">{CHANGE_FIELD_LABELS[field] ?? field}:</span>{' '}
                                    <span className="line-through opacity-60">{change.old || '—'}</span>
                                    {' → '}
                                    <span className="font-semibold">{change.new || '—'}</span>
                                  </span>
                                ))}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default PreparedListsPage;
