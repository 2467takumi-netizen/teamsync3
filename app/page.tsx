'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [mounted, setMounted] = useState(false);
  
  // ユーザー・プロフィール関連
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // アプリの状態管理
  const [appState, setAppState] = useState<
    'loading' | 'auth' | 'nickname-setup' | 'main'
  >('loading');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login'); // 新規登録/ログイン切り替え
  
  // UI状態
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<
    'tasks' | 'log' | 'ranking' | 'profile' | 'members' | 'settings'
  >('tasks');
  const [isMyTasksMode, setIsMyTasksMode] = useState(false);

  // データ
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [todos, setTodos] = useState<any[]>([]);
  const [completedLogs, setCompletedLogs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);

  // フォーム入力用
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskUrl, setNewTaskUrl] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [quickSubInputs, setQuickSubInputs] = useState<
    Record<string, { text: string; assignee: string; due: string; url: string }>
  >({});

  // 認証・設定用入力
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // ■ 初期化とセッション監視
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkProfile(session.user.id);
      } else {
        setAppState('auth');
      }
    });

    // Auth状態の変化を監視（ログアウトやサインアップ後の自動ログイン対応）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        checkProfile(session.user.id);
      } else {
        setAppState('auth');
        setUser(null);
      }
    });

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
  }, []);

  // ■ プロフィール確認・取得
  const checkProfile = async (uid: string) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
      
    if (prof?.nickname) {
      setProfile(prof);
      setEditNickname(prof.nickname);
      setEditStatus(prof.status_message || '');
      setAppState('main');
      fetchProjects(uid);
    } else {
      // ニックネーム未登録ならセットアップ画面へ
      setAppState('nickname-setup');
    }
  };

  // ■ 認証処理 (ログイン / 新規登録)
  const handleAuth = async () => {
    if (!email || !password) return alert('メールとパスワードを入力してください');
    
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        alert('登録エラー: ' + error.message);
      } else {
        alert('確認メールを送信しました！メール内のリンクをクリックしてください。');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert('ログインエラー: ' + error.message);
      } else {
        // 成功時はonAuthStateChangeが検知して画面遷移します
      }
    }
  };

  // ■ プロジェクト一覧取得
  const fetchProjects = async (uid: string) => {
    const { data: mData } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', uid);
    const pIds = mData?.map((m) => m.project_id) || [];
    
    const { data } = await supabase
      .from('projects')
      .select('*')
      .in('id', pIds)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    setProjects(data || []);
  };

  // ■ プロジェクト詳細取得
  const fetchProjectDetails = async (project: any) => {
    if (!project) return;
    setIsMyTasksMode(false);
    setViewMode('tasks');
    setSelectedProject(project);
    setIsSidebarOpen(false);

    // 未完了タスク
    const { data: tData } = await supabase
      .from('todos')
      .select('*, profiles:assigned_to(nickname)')
      .eq('project_id', project.id)
      .eq('completed', false)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    setTodos(tData || []);

    // 完了履歴
    const { data: logData } = await supabase
      .from('todos')
      .select('*, profiles:assigned_to(nickname)')
      .eq('project_id', project.id)
      .eq('completed', true)
      .limit(20)
      .order('updated_at', { ascending: false });
    setCompletedLogs(logData || []);

    // メンバー
    const { data: memData } = await supabase
      .from('project_members')
      .select('*, profiles(nickname, status_message)')
      .eq('project_id', project.id);
    setMembers(memData || []);
  };

  // ■ 「自分のタスク」読み込み
  const loadMyTasks = async () => {
    setIsMyTasksMode(true);
    setViewMode('tasks');
    setSelectedProject(null); // ここがnullになるため、エラー修正が必要だった
    setIsSidebarOpen(false);
    
    const { data } = await supabase
      .from('todos')
      .select('*, projects!inner(name)')
      .eq('assigned_to', user.id)
      .eq('completed', false)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    setTodos(data || []);
    // MyTasksモードではメンバー一覧は取得できないため空にするか、キャッシュを使う
    setMembers([]); 
  };

  // ■ ランキング取得
  const fetchRankings = async () => {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, nickname, status_message')
      .limit(20);
      
    const results = await Promise.all(
      (profs || []).map(async (p) => {
        const { count } = await supabase
          .from('todos')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', p.id)
          .eq('completed', true);
        return { ...p, completed_count: count || 0 };
      })
    );
    setRankings(results.sort((a, b) => b.completed_count - a.completed_count));
    setViewMode('ranking');
    setIsSidebarOpen(false);
  };

  // ■ タスク追加
  const addTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return;
    
    const base = {
      project_id: selectedProject.id,
      assigned_to: newTaskAssignee || user.id,
      due_date: newTaskDueDate || null,
      link_url: newTaskUrl || null,
      sort_order: todos.length,
      completed: false,
      subtasks: [],
    };
    
    // todosテーブルのカラム名に合わせて調整 (title or text)
    let { data, error } = await supabase
      .from('todos')
      .insert([{ ...base, text: newTaskTitle }]) // textカラムを想定
      .select('*, profiles:assigned_to(nickname)')
      .single();
      
    if (error) {
      // titleカラムかもしれないのでリトライ
      const { data: retry } = await supabase
        .from('todos')
        .insert([{ ...base, title: newTaskTitle }])
        .select('*, profiles:assigned_to(nickname)')
        .single();
      data = retry;
    }
    
    if (data) {
      setTodos([...todos, data]);
      setNewTaskTitle('');
      setNewTaskUrl('');
      setNewTaskDueDate('');
    }
  };

  // ■ タスク更新（エラー修正済み）
  const updateTask = async (taskId: string, updates: any) => {
    const { error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', taskId);
      
    if (!error) {
      if (updates.completed === true) {
        // ★★★ 修正ポイント ★★★
        // プロジェクト選択中ならプロジェクト詳細を再取得
        if (selectedProject) {
          fetchProjectDetails(selectedProject);
        } else {
          // 「自分のタスク」モードなら、自分のタスク一覧を再取得
          loadMyTasks();
        }
      } else {
        // 完了以外の更新はstateのみ更新してサクサク動かす
        setTodos((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
        );
      }
    }
  };

  // ■ タスク削除
  const deleteTask = async (taskId: string) => {
    if (!confirm('削除しますか？')) return;
    await supabase.from('todos').delete().eq('id', taskId);
    setTodos((prev) => prev.filter((t) => t.id !== taskId));
  };

  // ■ 小タスク追加
  const addQuickSubTask = async (task: any) => {
    const input = quickSubInputs[task.id] || {
      text: '',
      assignee: '',
      due: '',
      url: '',
    };
    if (!input.text.trim()) return;
    
    const newSub = {
      text: input.text,
      completed: false,
      assigned_to: input.assignee || user.id,
      due_date: input.due || null,
      link_url: input.url || null,
    };
    
    const newSubs = [...(task.subtasks || []), newSub];
    
    await supabase
      .from('todos')
      .update({ subtasks: newSubs })
      .eq('id', task.id);
      
    setTodos((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, subtasks: newSubs } : t))
    );
    
    setQuickSubInputs({
      ...quickSubInputs,
      [task.id]: { text: '', assignee: '', due: '', url: '' },
    });
  };

  if (!mounted) return null;

  // ------------------------------------------------
  // 1. 認証画面（ログイン / 新規登録）
  // ------------------------------------------------
  if (appState === 'auth')
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-left">
        <div className="bg-white w-full max-w-sm p-10 rounded-[2.5rem] shadow-2xl space-y-6 text-slate-900">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-center">
            Team Sync
          </h1>

          {/* モード切替タブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'login' ? 'bg-white shadow text-blue-600' : 'text-slate-400'
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'signup' ? 'bg-white shadow text-blue-600' : 'text-slate-400'
              }`}
            >
              新規登録
            </button>
          </div>
          
          <div className="space-y-4">
            <input
              placeholder="Email"
              type="email"
              className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-bold text-slate-700"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-bold text-slate-700"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-colors"
            >
              {authMode === 'login' ? 'ログイン' : '新規登録して開始'}
            </button>
          </div>
          
          {authMode === 'signup' && (
            <p className="text-[10px] text-slate-400 text-center font-bold">
              ※ 確認メールが届きます。リンクをクリックして完了してください。
            </p>
          )}
        </div>
      </div>
    );

  // ------------------------------------------------
  // 2. 初回プロフィールセットアップ画面
  // ------------------------------------------------
  if (appState === 'nickname-setup')
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-left">
        <div className="bg-white w-full max-w-sm p-10 rounded-[2.5rem] shadow-xl space-y-6 text-slate-900 border border-slate-100">
          <h2 className="text-xl font-black italic uppercase">Welcome!</h2>
          <p className="text-xs font-bold text-slate-500">
            チームで使う名前と、意気込みを入力してください。
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-blue-500">Nickname</label>
              <input
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="表示名"
                className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-black text-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-blue-500">Status Message</label>
              <input
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                placeholder="例: がんばります！"
                className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold"
              />
            </div>
            <button
              onClick={async () => {
                if (!editNickname) return alert("ニックネームは必須です");
                const { error } = await supabase
                  .from('profiles')
                  .upsert({
                    id: user.id,
                    nickname: editNickname,
                    status_message: editStatus,
                  });
                if (!error) checkProfile(user.id);
                else alert(error.message);
              }}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg"
            >
              スタート！
            </button>
          </div>
        </div>
      </div>
    );

  // ------------------------------------------------
  // 3. メイン画面（サイドバー + コンテンツ）
  // ------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900 font-sans overflow-hidden text-left">
      {/* サイドバー */}
      <aside
        className={`fixed md:relative w-72 h-full bg-[#1e293b] text-white p-8 flex flex-col z-[70] transition-transform duration-500 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex justify-between items-center mb-10 text-left">
          <h1 className="text-xl font-black italic text-blue-400 uppercase tracking-tighter">
            Team Sync
          </h1>
          <button
            onClick={() => {
              setViewMode('profile');
              setIsSidebarOpen(false);
            }}
            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black border-2 border-white/20"
          >
            {profile?.nickname?.[0]}
          </button>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto scrollbar-hide text-left">
          <button
            onClick={loadMyTasks}
            className={`w-full p-4 rounded-2xl text-xs font-black flex items-center gap-3 transition-all ${
              isMyTasksMode
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            👤 自分のタスク
          </button>
          <button
            onClick={fetchRankings}
            className={`w-full p-4 rounded-2xl text-xs font-black flex items-center gap-3 ${
              viewMode === 'ranking'
                ? 'bg-yellow-500 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            🏆 ランキング
          </button>
          
          <p className="text-[10px] font-black px-4 mt-8 mb-2 uppercase tracking-widest text-slate-500">
            Workspace
          </p>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => fetchProjectDetails(p)}
              className={`w-full text-left p-4 rounded-2xl text-xs font-bold truncate transition-all ${
                selectedProject?.id === p.id && !isMyTasksMode
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              📁 {p.name}
            </button>
          ))}
          
          <button
            onClick={() => {
              const c = prompt('招待ID(UUID)を入力');
              if (c)
                supabase
                  .from('project_members')
                  .insert([{ project_id: c, user_id: user.id, role: '一般' }])
                  .then(() => fetchProjects(user.id));
            }}
            className="w-full text-left px-4 py-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-white transition-colors"
          >
            + 招待コードで参加
          </button>
        </nav>
        
        <button
          onClick={async () => {
            const name = prompt('PJ名');
            if (name) {
              const { data } = await supabase
                .from('projects')
                .insert([{ name, sort_order: projects.length }])
                .select()
                .single();
              if (data) {
                await supabase
                  .from('project_members')
                  .insert([
                    { project_id: data.id, user_id: user.id, role: '管理者' },
                  ]);
                fetchProjects(user.id);
              }
            }
          }}
          className="mt-4 border border-dashed border-slate-600 p-4 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white transition-all"
        >
          + PJ新規作成
        </button>
        
        <button
          onClick={() =>
            supabase.auth.signOut().then(() => window.location.reload())
          }
          className="mt-4 p-2 text-left text-red-400 text-[10px] font-black uppercase opacity-60"
        >
          ログアウト 👋
        </button>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col min-w-0">
        {/* モバイル用ヘッダー */}
        <header className="md:hidden bg-[#1e293b] text-white p-5 flex justify-between items-center sticky top-0 z-50 text-left">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-slate-800 rounded-xl"
          >
            三
          </button>
          <h2 className="font-black italic uppercase text-xs">Team Sync</h2>
          <div className="w-8"></div>
        </header>

        <div className="p-6 md:p-16 max-w-5xl mx-auto w-full flex-1">
          {/* ページタイトルエリア */}
          <div className="flex justify-between items-end mb-12 border-b pb-8 text-left animate-in fade-in duration-700">
            <div className="text-left">
              <h2 className="text-4xl md:text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
                {viewMode === 'ranking'
                  ? 'Leaderboard'
                  : viewMode === 'profile'
                  ? 'Profile'
                  : isMyTasksMode
                  ? 'My Tasks'
                  : selectedProject
                  ? selectedProject.name
                  : 'Dashboard'}
              </h2>
              {profile?.status_message && (
                <p className="text-xs font-bold text-blue-500 mt-2 italic">
                  💬 「{profile.status_message}」
                </p>
              )}
            </div>
            
            {/* プロジェクトメニュータブ */}
            {selectedProject && (
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('log')}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${
                    viewMode === 'log'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  📋 履歴
                </button>
                <button
                  onClick={() => setViewMode('tasks')}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${
                    viewMode === 'tasks'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  ⚡ タスク
                </button>
                <button
                  onClick={() => setViewMode('members')}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${
                    viewMode === 'members'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  🤝 メンバー
                </button>
                <button
                  onClick={() => setViewMode('settings')}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${
                    viewMode === 'settings'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  ⚙️ 設定
                </button>
              </div>
            )}
          </div>

          {/* ビュー切り替え */}
          {viewMode === 'tasks' && (selectedProject || isMyTasksMode) ? (
            <div className="animate-in fade-in text-left">
              
              {/* 新規タスク入力 (プロジェクト選択時のみ) */}
              {selectedProject && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-10 space-y-4">
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder="新しい大タスク..."
                    className="w-full text-xl font-black border-none outline-none text-slate-800"
                  />
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      placeholder="🔗 リンクURL"
                      value={newTaskUrl}
                      onChange={(e) => setNewTaskUrl(e.target.value)}
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold flex-1 outline-none text-slate-900"
                    />
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold text-slate-900"
                    />
                    <select
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="">担当者を選択</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.profiles?.nickname}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addTask}
                      className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg"
                    >
                      追加
                    </button>
                  </div>
                </div>
              )}

              {/* タスク一覧 */}
              <div className="space-y-10">
                {todos.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col group text-left"
                  >
                    {/* 親タスク行 */}
                    <div className="flex items-center justify-between mb-4 text-left">
                      <div className="flex items-center gap-4 flex-1 text-left">
                        {/* 完了ボタン */}
                        <div
                          onClick={() =>
                            updateTask(task.id, { completed: true })
                          }
                          className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center transition-all hover:bg-green-500 hover:text-white cursor-pointer font-bold text-transparent"
                        >
                          ✓
                        </div>
                        {/* タスク詳細編集 */}
                        <div className="flex-1 text-left text-slate-900">
                          <input
                            className="text-xl font-black bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                            value={task.text || task.title}
                            onChange={(e) =>
                              updateTask(task.id, {
                                text: e.target.value,
                                title: e.target.value,
                              })
                            }
                          />
                          <div className="flex gap-4 mt-1 items-center flex-wrap">
                            <span className="text-[10px] font-black text-blue-500 uppercase">
                              Assignee: {task.profiles?.nickname || '未定'}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded uppercase tracking-widest">
                                ⏰ {task.due_date}
                              </span>
                            )}
                            {task.link_url && (
                              <a
                                href={task.link_url}
                                target="_blank"
                                className="text-[10px] font-black text-blue-400 underline"
                              >
                                🔗 外部リンク
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 削除ボタン */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all text-xl"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* 小タスクエリア */}
                    <div className="ml-14 border-l-4 border-slate-50 pl-8 space-y-4">
                      {task.subtasks?.map((st: any, i: number) => (
                        <div
                          key={i}
                          className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-2 border border-slate-100 text-left"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <input
                              type="checkbox"
                              checked={st.completed}
                              onChange={() => {
                                const n = [...task.subtasks];
                                n[i].completed = !n[i].completed;
                                updateTask(task.id, { subtasks: n });
                              }}
                              className="w-5 h-5 accent-blue-600 rounded"
                            />
                            <span
                              className={`font-bold flex-1 ${
                                st.completed
                                  ? 'line-through text-slate-300'
                                  : 'text-slate-700'
                              }`}
                            >
                              {st.text}
                            </span>
                            {st.link_url && (
                              <a
                                href={st.link_url}
                                target="_blank"
                                className="text-[10px] font-black text-blue-500"
                              >
                                🔗 Link
                              </a>
                            )}
                          </div>
                          
                          <div className="flex gap-3 ml-8 text-left flex-wrap">
                            <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">
                                Person:
                              </span>
                              <span className="text-[11px] font-black text-slate-900">
                                {members.find(
                                  (m) => m.user_id === st.assigned_to
                                )?.profiles?.nickname || '未定'}
                              </span>
                            </div>
                            {st.due_date && (
                              <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm text-red-500">
                                <span className="text-[10px] font-black uppercase tracking-tighter">
                                  Due:
                                </span>
                                <span className="text-[11px] font-black">
                                  {st.due_date}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* 小タスク追加フォーム */}
                      <div className="flex flex-col gap-2 p-4 bg-white border-2 border-dashed rounded-2xl text-left">
                        <input
                          value={quickSubInputs[task.id]?.text || ''}
                          onChange={(e) =>
                            setQuickSubInputs({
                              ...quickSubInputs,
                              [task.id]: {
                                ...(quickSubInputs[task.id] || {
                                  assignee: '',
                                  due: '',
                                  url: '',
                                }),
                                text: e.target.value,
                              },
                            })
                          }
                          onKeyDown={(e) =>
                            e.key === 'Enter' && addQuickSubTask(task)
                          }
                          placeholder="+ 小タスクを追加..."
                          className="text-sm font-bold bg-transparent outline-none text-slate-800"
                        />
                        <div className="flex gap-2 flex-wrap items-center">
                          <input
                            placeholder="🔗 URL"
                            value={quickSubInputs[task.id]?.url || ''}
                            onChange={(e) =>
                              setQuickSubInputs({
                                ...quickSubInputs,
                                [task.id]: {
                                  ...(quickSubInputs[task.id] || {
                                    text: '',
                                    assignee: '',
                                    due: '',
                                  }),
                                  url: e.target.value,
                                },
                              })
                            }
                            className="text-[10px] bg-slate-50 p-2 rounded-lg outline-none flex-1 font-bold text-slate-900"
                          />
                          <input
                            type="date"
                            value={quickSubInputs[task.id]?.due || ''}
                            onChange={(e) =>
                              setQuickSubInputs({
                                ...quickSubInputs,
                                [task.id]: {
                                  ...(quickSubInputs[task.id] || {
                                    text: '',
                                    assignee: '',
                                    url: '',
                                  }),
                                  due: e.target.value,
                                },
                              })
                            }
                            className="text-[10px] bg-slate-50 p-2 rounded-lg font-black text-slate-900"
                          />
                          <select
                            className="text-[10px] bg-slate-50 p-2 rounded-lg font-black text-slate-900"
                            value={quickSubInputs[task.id]?.assignee || ''}
                            onChange={(e) =>
                              setQuickSubInputs({
                                ...quickSubInputs,
                                [task.id]: {
                                  ...(quickSubInputs[task.id] || {}),
                                  assignee: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">担当者</option>
                            {members.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.profiles?.nickname}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => addQuickSubTask(task)}
                            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'ranking' ? (
            <div className="space-y-6 animate-in zoom-in-95 text-left">
              {rankings.map((r, i) => (
                <div
                  key={r.id}
                  className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-8 text-left">
                    <span
                      className={`text-6xl font-black italic ${
                        i === 0 ? 'text-yellow-400' : 'text-slate-100'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900">
                        {r.nickname}
                      </h4>
                      <p className="text-sm font-bold text-slate-400 italic">
                        「{r.status_message || 'No status'}」
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-slate-900">
                    <p className="text-5xl font-black text-blue-600">
                      {r.completed_count}
                    </p>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">
                      Tasks Done
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'profile' ? (
            <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-10 text-left">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase mb-2">
                  Display Name
                </p>
                <input
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full text-4xl font-black italic border-b-4 border-slate-100 outline-none focus:border-blue-500 text-slate-900"
                />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase mb-2">
                  Status Message
                </p>
                <input
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  placeholder="意気込みをどうぞ！"
                  className="w-full text-2xl font-bold border-b-2 border-slate-100 outline-none focus:border-blue-500 text-slate-900"
                />
              </div>
              <button
                onClick={async () => {
                  await supabase
                    .from('profiles')
                    .upsert({
                      id: user.id,
                      nickname: editNickname,
                      status_message: editStatus,
                    });
                  alert('更新しました！');
                  checkProfile(user.id);
                }}
                className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
              >
                変更を保存
              </button>
            </div>
          ) : viewMode === 'settings' && selectedProject ? (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left animate-in slide-in-from-bottom-10 text-slate-900">
              <h3 className="text-2xl font-black italic mb-8 uppercase text-left">
                Project Settings
              </h3>
              <section className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-left">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">
                  プロジェクト招待ID (UUID)
                </p>
                <div className="flex items-center gap-3 text-left">
                  <code className="bg-white px-4 py-3 rounded-xl flex-1 text-xs font-mono font-bold border text-slate-600 truncate">
                    {selectedProject.id}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProject.id);
                      alert('IDをコピーしました！');
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </section>
              <button
                onClick={async () => {
                  if (confirm('PJを削除しますか？')) {
                    await supabase
                      .from('projects')
                      .update({ deleted_at: new Date() })
                      .eq('id', selectedProject.id);
                    window.location.reload();
                  }
                }}
                className="mt-8 bg-red-50 text-red-500 px-8 py-4 rounded-2xl font-black text-xs hover:bg-red-500 hover:text-white transition-all"
              >
                プロジェクトを完全に削除する
              </button>
            </div>
          ) : viewMode === 'members' && selectedProject ? (
            <div className="space-y-6 text-left">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-900">
                        {m.profiles?.nickname}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                          m.role === '管理者'
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold mt-1 italic">
                      {m.profiles?.status_message || 'メッセージなし'}
                    </p>
                  </div>
                  {user.id !== m.user_id &&
                    members.find((x) => x.user_id === user.id)?.role ===
                      '管理者' && (
                      <button
                        onClick={async () => {
                          if (confirm('追放しますか？')) {
                            await supabase
                              .from('project_members')
                              .delete()
                              .eq('project_id', selectedProject.id)
                              .eq('user_id', m.user_id);
                            fetchProjectDetails(selectedProject);
                          }
                        }}
                        className="text-red-500 font-black text-[10px] uppercase"
                      >
                        Kick Member
                      </button>
                    )}
                </div>
              ))}
            </div>
          ) : viewMode === 'log' ? (
            <div className="space-y-4 text-left animate-in fade-in">
              <h3 className="text-xl font-black italic mb-6 text-slate-400">
                Completed History
              </h3>
              {completedLogs.map((l) => (
                <div
                  key={l.id}
                  className="bg-white p-6 rounded-[2.5rem] border-l-8 border-green-500 flex items-center gap-4 shadow-sm opacity-80 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div className="text-left text-slate-900">
                    <p className="font-black line-through">
                      {l.text || l.title}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                      完了: {new Date(l.updated_at).toLocaleString()} | 担当:{' '}
                      {l.profiles?.nickname || '不明'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}