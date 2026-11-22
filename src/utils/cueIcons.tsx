import React from 'react';
import {
  Lightbulb,
  BookOpen,
  Compass,
  Flame,
  Layers,
  Sparkles,
  Target,
  Bookmark,
  Code2,
  Terminal
} from 'lucide-react';
import { CueIconKey } from '../types';

export const CueIcon: React.FC<{
  icon?: CueIconKey;
  className?: string;
  color?: string;
}> = ({ icon = 'lightbulb', className = 'w-4 h-4', color }) => {
  const style = color ? { color } : undefined;
  switch (icon) {
    case 'book':
      return <BookOpen className={className} style={style} />;
    case 'target':
      return <Target className={className} style={style} />;
    case 'code':
      return <Code2 className={className} style={style} />;
    case 'bookmark':
      return <Bookmark className={className} style={style} />;
    case 'compass':
      return <Compass className={className} style={style} />;
    case 'flame':
      return <Flame className={className} style={style} />;
    case 'layers':
      return <Layers className={className} style={style} />;
    case 'sparkles':
      return <Sparkles className={className} style={style} />;
    case 'terminal':
      return <Terminal className={className} style={style} />;
    case 'lightbulb':
    default:
      return <Lightbulb className={className} style={style} />;
  }
};
