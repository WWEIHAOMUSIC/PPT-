import { Slide } from "../types";
import { Plus, Trash2, ArrowUp, ArrowDown, Layers } from "lucide-react";

interface SlideThumbnailListProps {
  slides: Slide[];
  currentIdx: number;
  onSelectSlide: (idx: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (idx: number) => void;
  onMoveSlide: (idx: number, direction: "up" | "down") => void;
}

export default function SlideThumbnailList({
  slides,
  currentIdx,
  onSelectSlide,
  onAddSlide,
  onDeleteSlide,
  onMoveSlide,
}: SlideThumbnailListProps) {
  return (
    <div className="w-64 bg-slate-50 border-r border-slate-200/80 flex flex-col h-full">
      {/* List Header */}
      <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-xs tracking-wider uppercase">幻灯大纲 ({slides.length} 页)</span>
        </div>
        <button
          onClick={onAddSlide}
          className="flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border border-emerald-200/30"
          title="插入新幻灯片页面"
        >
          <Plus className="w-3.5 h-3.5" />
          加页
        </button>
      </div>

      {/* Thumbnails Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
        {slides.map((slide, idx) => {
          const isSelected = idx === currentIdx;
          const charCount = slide.script?.length || 0;

          return (
            <div
              key={slide.id}
              className={`relative rounded-xl border group transition-all duration-200 ${
                isSelected
                  ? "border-emerald-600 ring-2 ring-emerald-50 bg-white shadow-md shadow-emerald-900/5 translate-x-1"
                  : "border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300"
              }`}
            >
              {/* Thumbnail Header details */}
              <div
                className="p-3.5 cursor-pointer flex items-start gap-2.5"
                onClick={() => onSelectSlide(idx)}
              >
                <div className={`w-5 h-5 rounded-md text-[10px] font-extrabold flex items-center justify-center transition-colors ${
                  isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-[#111] text-xs truncate leading-normal">
                    {slide.title || `第 ${idx + 1} 页课件`}
                  </h4>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] font-medium text-slate-400">
                    <span className="truncate max-w-[80px]">
                      {slide.content.length > 0 ? `${slide.content.length} 行纲要` : "无纲要文本"}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-sm ${
                      charCount > 0 ? "bg-emerald-50 text-emerald-600 font-bold" : "bg-amber-50 text-amber-600 font-mono"
                    }`}>
                      {charCount > 0 ? `${charCount}字旁白` : "待生成配音"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manipulation Handles (Re-order & delete) */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-white/90 p-0.5 rounded-md shadow-xs border border-slate-100">
                <button
                  disabled={idx === 0}
                  onClick={() => onMoveSlide(idx, "up")}
                  className={`p-1 rounded-sm transition-colors ${
                    idx === 0 ? "text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                  title="上移"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={idx === slides.length - 1}
                  onClick={() => onMoveSlide(idx, "down")}
                  className={`p-1 rounded-sm transition-colors ${
                    idx === slides.length - 1 ? "text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                  title="下移"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={slides.length <= 1}
                  onClick={() => onDeleteSlide(idx)}
                  className={`p-1 rounded-sm transition-colors ${
                    slides.length <= 1 ? "text-slate-200" : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  }`}
                  title="删除本页"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
