import { describe, it, expect } from 'vitest';
import {
  extractKeyTokens,
  evaluateConceptOffline,
  buildOfflineScenario,
  buildOfflineAutoLinks
} from '../server/services/offlineFallback';

describe('offlineFallback service', () => {
  it('extracts meaningful non-stop-word tokens', () => {
    const tokens = extractKeyTokens('The Maillard reaction occurs with dry heat and sugars.');
    expect(tokens).toContain('maillard');
    expect(tokens).toContain('reaction');
    expect(tokens).toContain('dry');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('and');
  });

  it('scores semantically overlapping explanations higher than unrelated text', () => {
    const good = evaluateConceptOffline(
      'Spaced Repetition',
      'Reviewing right before you forget stretches intervals over time.',
      'Review right before an idea fades.',
      'Reviewing ideas just before forgetting strengthens memory and stretches intervals.',
      'Offline check'
    );
    const weak = evaluateConceptOffline(
      'Spaced Repetition',
      'Reviewing right before you forget stretches intervals over time.',
      'Review right before an idea fades.',
      'Bananas yellow fruit market basket morning sunshine.',
      'Offline check'
    );

    expect(good.score).toBeGreaterThan(weak.score);
    expect(good.mode).toBe('offline-fallback');
  });

  it('builds a valid offline scenario structure', () => {
    const scenario = buildOfflineScenario(
      'Maillard Reaction',
      'Dry heat above 140C browns food.',
      'Moisture traps temperature at 100C.'
    );
    expect(scenario.options).toHaveLength(3);
    expect(scenario.correctIndex).toBe(0);
    expect(scenario.mode).toBe('offline-fallback');
  });

  it('suggests relevant auto-links while excluding the source node itself', () => {
    const sourceNode = {
      id: 'node-1',
      title: 'Maillard Reaction',
      summary: 'Dry heat browning reaction between amino acids and sugars.',
      tags: ['cooking', 'chemistry']
    };
    const existingNodes = [
      sourceNode,
      {
        id: 'node-2',
        title: 'Caramelization Chemistry',
        summary: 'Dry heat sugar browning without amino acids.',
        tags: ['cooking', 'chemistry']
      },
      {
        id: 'node-3',
        title: 'Socratic Questioning',
        summary: 'Asking probing questions to uncover assumptions.',
        tags: ['philosophy']
      }
    ];

    const links = buildOfflineAutoLinks(sourceNode, existingNodes);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.targetNodeId !== 'node-1')).toBe(true);
    expect(links[0].targetNodeId).toBe('node-2');
    expect(links[0].relationship).toBe('associated_with');
  });
});
