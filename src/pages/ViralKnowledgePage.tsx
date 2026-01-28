import React from 'react';
import { BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ViralKnowledgeBase from '../components/ViralKnowledgeBase';

export default function ViralKnowledgePage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="拆解知识库" 
        icon={BookOpen}
        description="管理您深度分析过的爆款笔记，快速复用爆款结构。"
      />
      <ViralKnowledgeBase />
    </div>
  );
}
