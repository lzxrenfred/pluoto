import {describe,expect,it} from 'vitest';
import {INITIAL_STATE} from './demo';
import {isRemotePlaneAccessKey,normalizeState,upsertGuest} from './plane-store';

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
  it('keeps legacy local review links out of the realtime adapter',()=>{
    expect(isRemotePlaneAccessKey('onboarding-final-review-2.local-account-flow')).toBe(false);
    expect(isRemotePlaneAccessKey('9fd81b85-0db0-4c10-99f5-d10098ada883.0bcd97e5-3639-472c-b814-ab5f53f7af31')).toBe(true);
  });
});
