import React from 'react';

interface ArticleEditorProps {
  content: string;
  isEditing: boolean;
  onChange: (val: string) => void;
}

export default function ArticleEditor({ content, isEditing, onChange }: ArticleEditorProps) {
  if (isEditing) {
    return (
      <textarea 
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[500px] p-4 bg-white border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-base leading-relaxed font-serif"
        placeholder="在此编辑长文内容..."
      />
    );
  }

  return (
    <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-wrap font-serif leading-loose">
      {content || '生成的内容为空'}
    </div>
  );
}
