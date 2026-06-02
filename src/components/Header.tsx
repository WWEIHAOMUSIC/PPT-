import React from "react";
import { BookOpen, Sparkles, RefreshCw } from "lucide-react";

interface HeaderProps {
  projectTitle: string;
  onRenameProject: (newName: string) => void;
  onReset: () => void;
}

export default function Header({ projectTitle, onRenameProject, onReset }: HeaderProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(projectTitle);

  React.useEffect(() => {
    setEditedTitle(projectTitle);
  }, [projectTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedTitle.trim()) {
      onRenameProject(editedTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-200">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-600 tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
              AI 智能多媒体教坊
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={30}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="px-2 py-0.5 border border-emerald-400 rounded-md text-slate-800 text-base font-bold focus:outline-hidden ring-2 ring-emerald-100"
                  autoFocus
                  onBlur={() => setIsEditing(false)}
                />
              </form>
            ) : (
              <h1
                onClick={() => setIsEditing(true)}
                title="双击或点击重命名微课项目"
                className="text-slate-800 font-bold text-lg hover:text-emerald-600 hover:bg-slate-50 cursor-pointer rounded-sm px-1.5 transition-all flex items-center gap-2"
              >
                {projectTitle}
                <Sparkles className="w-4 h-4 text-emerald-500/80 animate-pulse ml-0.5" />
              </h1>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg font-medium transition-colors"
          title="清空当前课件重新配置"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重置工作区
        </button>
        <div className="px-3 py-1.5 bg-slate-100 text-slate-600 font-mono text-xs rounded-lg border border-slate-200/50">
          <span>Kejianbang Mini • v1.2</span>
        </div>
      </div>
    </header>
  );
}
