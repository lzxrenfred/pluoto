import {describe,expect,it} from 'vitest';
import {INITIAL_STATE} from './demo';
import {normalizeState,upsertGuest} from './plane-store';

describe('plane state',()=>{
  it('migrates older local state without guests',()=>{
    const migrated=normalizeState({...INITIAL_STATE,guests:undefined} as never,INITIAL_STATE);
    expect(migrated.guests).toEqual([]);
    expect(migrated.people).toHaveLength(4);
  });
  it('remembers one current record per anonymous guest',()=>{
    const guest={id:'device-1',nickname:'Ari',species:'rabbit' as const,color:'#f7eee5',joinedAt:1};
    const first=upsertGuest(INITIAL_STATE,guest);
    const second=upsertGuest(first,{...guest,nickname:'Ari again'});
    expect(second.guests).toHaveLength(1);
    expect(second.guests[0].nickname).toBe('Ari again');
  });
});
