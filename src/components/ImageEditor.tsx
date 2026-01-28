import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Type, Image as ImageIcon, Move, RotateCw, Trash2 } from 'lucide-react';

interface StickerElement {
  id: string;
  type: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize?: number;
  color?: string;
  opacity: number;
}

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (editedImage: string) => void;
}

export default function ImageEditor({ imageUrl, onClose, onSave }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<StickerElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // 预设贴纸
  const presetStickers = [
    '⭐', '❤️', '🔥', '💎', '👑', '🎯', '✨', '🌟', '💫', '🎨',
    '©', '®', '™', 'TOP', 'NEW', 'HOT', 'SALE', 'BEST'
  ];

  // 预设颜色
  const presetColors = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  useEffect(() => {
    drawCanvas();
  }, [elements, imageLoaded]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 绘制背景图片
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // 绘制所有元素
      elements.forEach(element => {
        ctx.save();
        
        // 设置透明度
        ctx.globalAlpha = element.opacity;
        
        // 移动到元素中心进行旋转
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        if (element.type === 'text') {
          // 绘制文字
          ctx.font = `${element.fontSize || 24}px Arial`;
          ctx.fillStyle = element.color || '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // 添加文字描边效果
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeText(element.content, element.x + element.width / 2, element.y + element.height / 2);
          ctx.fillText(element.content, element.x + element.width / 2, element.y + element.height / 2);
        } else if (element.type === 'image') {
          // 绘制emoji或简单图形
          ctx.font = `${element.fontSize || 24}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(element.content, element.x + element.width / 2, element.y + element.height / 2);
        }

        // 如果是选中元素，绘制边框
        if (element.id === selectedElement) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(element.x, element.y, element.width, element.height);
          ctx.setLineDash([]);
        }

        ctx.restore();
      });

      setImageLoaded(true);
    };
    img.src = imageUrl;
  };

  const addTextElement = () => {
    const newElement: StickerElement = {
      id: Date.now().toString(),
      type: 'text',
      content: '双击编辑文字',
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      rotation: 0,
      fontSize: 24,
      color: '#FFFFFF',
      opacity: 1
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const addStickerElement = (sticker: string) => {
    const newElement: StickerElement = {
      id: Date.now().toString(),
      type: 'image',
      content: sticker,
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 0,
      fontSize: 40,
      opacity: 1
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 查找点击的元素
    const clickedElement = elements.find(element => {
      return x >= element.x && x <= element.x + element.width &&
             y >= element.y && y <= element.y + element.height;
    });

    if (clickedElement) {
      setSelectedElement(clickedElement.id);
      setIsDragging(true);
      setDragOffset({ x: x - clickedElement.x, y: y - clickedElement.y });
    } else {
      setSelectedElement(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setElements(elements.map(element => 
      element.id === selectedElement
        ? { ...element, x: x - dragOffset.x, y: y - dragOffset.y }
        : element
    ));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const updateSelectedElement = (updates: Partial<StickerElement>) => {
    if (!selectedElement) return;
    
    setElements(elements.map(element => 
      element.id === selectedElement
        ? { ...element, ...updates }
        : element
    ));
  };

  const deleteSelectedElement = () => {
    if (!selectedElement) return;
    setElements(elements.filter(element => element.id !== selectedElement));
    setSelectedElement(null);
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const editedImage = canvas.toDataURL('image/png');
    onSave(editedImage);
  };

  const selectedElementData = elements.find(e => e.id === selectedElement);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex">
        {/* 左侧工具栏 */}
        <div className="w-80 p-4 border-r border-gray-200 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">图片编辑器</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* 添加文字 */}
          <div className="mb-6">
            <button
              onClick={addTextElement}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Type size={16} className="mr-2" />
              添加文字
            </button>
          </div>

          {/* 预设贴纸 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">贴纸</h4>
            <div className="grid grid-cols-6 gap-2">
              {presetStickers.map((sticker, index) => (
                <button
                  key={index}
                  onClick={() => addStickerElement(sticker)}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-lg"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </div>

          {/* 选中元素编辑 */}
          {selectedElementData && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">编辑元素</h4>
              
              {selectedElementData.type === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">文字内容</label>
                    <input
                      type="text"
                      value={selectedElementData.content}
                      onChange={(e) => updateSelectedElement({ content: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">字体大小</label>
                  <input
                    type="range"
                    min="12"
                    max="100"
                    value={selectedElementData.fontSize || 24}
                    onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">透明度</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={selectedElementData.opacity}
                    onChange={(e) => updateSelectedElement({ opacity: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs text-gray-600 mb-1">旋转角度</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedElementData.rotation}
                  onChange={(e) => updateSelectedElement({ rotation: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {selectedElementData.type === 'text' && (
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">颜色</label>
                  <div className="flex gap-1 flex-wrap">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateSelectedElement({ color })}
                        className="w-6 h-6 rounded border-2 border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={deleteSelectedElement}
                className="w-full mt-3 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                <Trash2 size={14} className="mr-1" />
                删除
              </button>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="space-y-2">
            <button
              onClick={saveImage}
              className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download size={16} className="mr-2" />
              保存图片
            </button>
          </div>
        </div>

        {/* 右侧画布区域 */}
        <div className="flex-1 p-4 flex items-center justify-center bg-gray-100">
          <div className="max-w-full max-h-full overflow-auto">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className="max-w-full max-h-full border border-gray-300 rounded shadow-lg cursor-pointer"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}