import { ConceptConnection, ConceptNode, GamificationStats } from '../types';
import { getCueSubject, getLocalDateKey } from '../utils/dateFilters';

export function buildMarkdownJournal(
  nodes: ConceptNode[],
  gamification: GamificationStats,
  dateLabel = getLocalDateKey()
): string {
  const grouped = new Map<string, ConceptNode[]>();
  nodes.forEach((n) => {
    const sub = getCueSubject(n);
    const arr = grouped.get(sub) || [];
    arr.push(n);
    grouped.set(sub, arr);
  });

  const lines: string[] = [
    `# RecallFlow Learning Journal (${dateLabel})`,
    `> Total Notes: ${nodes.length} | Streak: ${gamification.streakDays} days | XP: ${gamification.xp}`,
    ''
  ];

  grouped.forEach((items, subject) => {
    lines.push(`## @${subject}`);
    lines.push('');
    items.forEach((n) => {
      lines.push(`### ${n.title}`);
      lines.push(`- **Key Takeaway:** ${n.summary}`);
      if (n.content && n.content !== n.summary) {
        lines.push(`- **Details:** ${n.content}`);
      }
      if (n.codeSnippet) {
        lines.push(`- **Quote / Reference:** > ${n.codeSnippet}`);
      }
      if (n.tags && n.tags.length > 0) {
        lines.push(`- **Tags:** ${n.tags.map((t) => `#${t}`).join(' ')}`);
      }
      lines.push(`- **Memory Strength:** ${n.srsData?.retentionScore || 80}%`);
      lines.push('');
    });
  });

  return lines.join('\n');
}

export function buildJsonBackup(payload: {
  notes: ConceptNode[];
  links: ConceptConnection[];
  subjects: string[];
  approvedTags: string[];
  gamification: GamificationStats;
}): string {
  return JSON.stringify(payload, null, 2);
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
