import { VinScanConsensus, consensusProgressLabel } from './vinScanConsensus';

describe('VinScanConsensus', () => {
  it('builds stable 17-char VIN from noisy readings', () => {
    const consensus = new VinScanConsensus();
    expect(consensus.add('JHMGD18908S212467')).toBeNull();
    expect(consensus.add('JHMGD18908S212467')).toBe('JHMGD18908S212467');
  });

  it('votes per character across mixed frames', () => {
    const consensus = new VinScanConsensus();
    consensus.add('JHMGD18908S212467');
    consensus.add('JHMGD18908S212467');
    consensus.add('JHMGD18908S212467');
    consensus.add('JHMGD189O8S212467');
    expect(consensus.getConsensus()).toBe('JHMGD18908S212467');
  });

  it('does not reset history on failed frame', () => {
    const consensus = new VinScanConsensus();
    consensus.add('JHMGD18908S212467');
    consensus.add('JHMGD18908S212467');
    consensus.add('JHMGD18908S212467');
    expect(consensus.add('ABC')).toBeNull();
    expect(consensus.getConsensus()).toBe('JHMGD18908S212467');
  });

  it('reports progress toward consensus', () => {
    const consensus = new VinScanConsensus();
    expect(consensus.getProgress()).toBe(0);
    consensus.add('JHMGD18908S212467');
    expect(consensus.getProgress()).toBeGreaterThan(0);
    expect(consensusProgressLabel(0.5)).toContain('Почти');
  });
});
