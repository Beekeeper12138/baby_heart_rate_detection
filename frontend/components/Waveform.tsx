import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface WaveformProps {
  isPlaying: boolean;
  color?: string;
}

const POINTS = 60;

export const Waveform: React.FC<WaveformProps> = ({ isPlaying, color = "#ef4444" }) => {
  const [data, setData] = useState<Array<{ val: number }>>(
    Array(POINTS).fill({ val: 50 })
  );
  const tickRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) return;

    // 重置计数器
    tickRef.current = 0;
    
    const interval = setInterval(() => {
      setData(prevData => {
        // 使用更高效的方式更新数据
        const newData = prevData.slice(1);
        tickRef.current += 0.2;
        // Simulate ECG QRS complex roughly
        const base = 50;
        let val = base + Math.sin(tickRef.current) * 5; 
        
        // 更有规律的心跳模拟，避免过多随机数生成
        const tickInt = Math.floor(tickRef.current);
        if (tickInt % 4 === 0 && Math.random() > 0.7) {
           val = 90; // R wave
        } else if (tickInt % 4 === 1 && Math.random() > 0.7) {
           val = 20; // S wave
        }

        newData.push({ val });
        return newData;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="w-full h-full select-none pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false} // Disable animation for real-time performance
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};