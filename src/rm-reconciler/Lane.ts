import { 
    Fiber, FiberRoot,
    BlockModel,ConcurrentModel,NoModel,
    OffscreenComponent
} from "./Fiber";
import { 
    scheduler_getCurrentPriority,
    scheduler_priorityType,
    scheduler_ImmediatelyPriority,
    scheduler_NormalPriority,
    scheduler_UserBlockPriority,
    scheduler_LowPrioity,
    scheduler_IdlePrioity,
 }from './schedulerWithReconciler';

export type Lane = 0|1|2|12|112|896|2147483648|67108863|4227858432
export const SyncLane = 0b00000000000000000000000000000001;
export const SyncBatchLane = 0b00000000000000000000000000000010;
export const UserContinuousInputLane = 0b00000000000000000000000000001100;
export const UserBlockLane  = 0b00000000000000000000000001110000;
export const NormallyLane =  0b00000000000000000000001110000000;
export const OffscreenLane = 0b10000000000000000000000000000000;
//剔除掉 低优先级lane
export const HightLane = 0b00000011111111111111111111111111;
export const idleLane = 0b11111100000000000000000000000000;
export const NotLane = 0b00000000000000000000000000000000;


//优先级相关
export type LanePriorityType = 0|9|10|11|12|13|14|15
export const notLanePriority = 0;
//最低优先级
export const OffscreenLanePriority = 9; 
export const idleLanePriority = 10;
export const NormallyPriority = 11;
//连续输入事件
export const UserBlockContinuousInputLanePriority = 12;
//非连续输入事件
export const UserBlockInputLanePriority = 13;
//同步批量更新
export const syncBatchLanePriority = 14;
//同步更新
export const sycLanePriority = 15;

//分片模式相关。想不处理
var currentEventWipLanes:Lane = NotLane
var return_highestLanePriority:LanePriorityType = notLanePriority

//lane位操作
function getHighestPriorityLane(lane: Lane):Lane {
    return (lane & -lane) as Lane;
}
function getLowestPriorityLane(lane: Lane): Lane {
    const index = 31 - Math.clz32(lane);
    return ( index < 0 ? NotLane : 1 << index ) as Lane;
}
function getEqualOrHigherPriorityLanes(lane: Lane): Lane {
    return ( (getLowestPriorityLane(lane) << 1) - 1) as Lane;
}
function getHighestPriorityLanes(lane:Lane):Lane{
    if( (lane&SyncLane) !== NotLane ){
        return_highestLanePriority =  sycLanePriority;
        return SyncLane
    }
    if( (lane&SyncBatchLane) !== NotLane ){
        return_highestLanePriority = syncBatchLanePriority;
        return SyncBatchLane 
    }
    // UserBlockContinuousInputLanePriority 暂时还没细分到，先临时用UserBlockInputLanePriority
    if( (lane&UserBlockLane) !== NotLane ){
        return_highestLanePriority =  UserBlockInputLanePriority;
        return UserBlockLane
    }
    if( (lane&NormallyLane) !== NotLane ){
        return_highestLanePriority =  NormallyPriority;
        return NormallyLane
    }
    if( (lane&idleLane) !== NotLane ){
        return_highestLanePriority =  idleLanePriority;
        return idleLane
    }
    
    return_highestLanePriority = notLanePriority
    return  NotLane
}
export function pickArbitraryLane(lane:Lane):Lane{
    return getHighestPriorityLane(lane)
}
//lane转换数组index
function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - Math.clz32(lanes);
}
function laneToIndex(lane: Lane) {
  return pickArbitraryLaneIndex(lane);
}


//lane转成优先级
export const laneToLanePriority = function(lane:Lane):LanePriorityType{
    if( (lane&SyncLane) !== NotLane ){
        return_highestLanePriority =  sycLanePriority;
        return return_highestLanePriority
    }
    if( (lane&SyncBatchLane) !== NotLane ){
        return_highestLanePriority = syncBatchLanePriority;
        return return_highestLanePriority 
    }
    if( (lane&UserContinuousInputLane) !== NotLane ){
        return_highestLanePriority =  UserBlockContinuousInputLanePriority;
        return return_highestLanePriority
    }
    if( (lane&UserBlockLane) !== NotLane ){
        return_highestLanePriority =  UserBlockInputLanePriority;
        return return_highestLanePriority
    }
    if( (lane&NormallyLane) !== NotLane ){
        return_highestLanePriority =  NormallyPriority;
        return return_highestLanePriority
    }
    if( (lane&idleLane) !== NotLane ){
        return_highestLanePriority =  idleLanePriority;
        return return_highestLanePriority
    }
    
    return_highestLanePriority = notLanePriority
    return return_highestLanePriority
}
//lane优先级转换sheduler优先级
export const lanePriorityToShedulerPriority = function(priority:LanePriorityType):scheduler_priorityType{
    switch(priority){
        case sycLanePriority:
        case syncBatchLanePriority:
            return scheduler_ImmediatelyPriority
        case UserBlockContinuousInputLanePriority:
        case UserBlockInputLanePriority:
            return scheduler_UserBlockPriority
        case NormallyPriority:
            return scheduler_NormalPriority;
        case OffscreenLanePriority:
        case idleLanePriority:
            return scheduler_IdlePrioity
    }
}
//sheduler优先级转换lane优先级
export const shedulerPriorityToLanePriority = function(priority:scheduler_priorityType):LanePriorityType{
    switch(priority){
        case scheduler_ImmediatelyPriority:
            return sycLanePriority
        case scheduler_UserBlockPriority:
            return UserBlockInputLanePriority
        case scheduler_NormalPriority:
            return NormallyPriority
        case scheduler_LowPrioity:
        case scheduler_IdlePrioity:
            return idleLanePriority
    }
}


export const requestUpdateLane = function(fiber:Fiber):Lane{
    //同步模式直接返回最高优先级
    if((fiber.mode & BlockModel) === NoModel){
        return SyncLane
    }else if((fiber.mode & ConcurrentModel) === NoModel){
        return scheduler_getCurrentPriority() === scheduler_ImmediatelyPriority? SyncLane: SyncBatchLane;
    }
    const schedulerPriority = scheduler_getCurrentPriority();
    const schedulerLanePriority = shedulerPriorityToLanePriority(
        schedulerPriority as scheduler_priorityType,
    );
    const lane = findUpdate(schedulerLanePriority, currentEventWipLanes);
    return lane
}
export const requestRetryLane = function(fiber:Fiber):Lane{
    return SyncLane
}
export const getNextLanes = function(root:FiberRoot,lane:Lane){
    if(root.pendingLane === NotLane){
        return_highestLanePriority = notLanePriority;
        return NotLane
    }
    let nextLanes = NotLane;
    let nextLanePriority = notLanePriority;
    const expiredLanes = root.expirationLane as Lane;
    const pendingLane = root.pendingLane as Lane
    //检查是否有超时
    if(expiredLanes !== NotLane){
        nextLanes = expiredLanes
        nextLanePriority =  return_highestLanePriority = sycLanePriority;
    }else{
        //暂时未实现挂起的lane suspendedLanes   = suspenseComponent
        //暂时未实现pingedLane = lazyComponent
        //暂时不使用低优先级的lane,从高优先级里面取
        const nonIdlePendingLanes = pendingLane & HightLane;
        nextLanes = getHighestPriorityLanes(nonIdlePendingLanes as Lane);
        nextLanePriority = return_highestLanePriority;
    }
    if(nextLanes === NotLane){
        return NotLane
    }    
    //是否包含更高优先级
    nextLanes = pendingLane & getEqualOrHigherPriorityLanes(nextLanes as Lane);
    //判断当前传入优先级是否更高
    if (
        lane !== NotLane &&
        lane !== nextLanes
    ){
        getHighestPriorityLanes(lane);
        const wipLanePriority = return_highestLanePriority;
        if (nextLanePriority <= wipLanePriority) {
            return lane;
        } else {
             return_highestLanePriority = nextLanePriority as LanePriorityType;
        }
    }
    //entangledLanes的情况先不处理
    return nextLanes
}
//寻找更新的lane
export const findUpdate = function( lanePriority: LanePriorityType,wipLanes: Lane){
    switch(lanePriority){
        case notLanePriority:
            break;
        case sycLanePriority:
            return SyncLane
        case syncBatchLanePriority:
            return SyncBatchLane
        //非同步的都需要向上寻找和向下寻找
        case UserBlockContinuousInputLanePriority:
            var lane = pickArbitraryLane((UserContinuousInputLane & ~wipLanes) as Lane);
            if(lane === NotLane){
                return findUpdate(UserBlockInputLanePriority,wipLanes)
            }
            return lane 
        case UserBlockInputLanePriority:
            var lane = pickArbitraryLane((UserBlockLane & ~wipLanes) as Lane);
            if(lane === NotLane){
                return findUpdate(NormallyPriority,wipLanes)
            }
            return lane 
        case NormallyPriority:
            var lane = pickArbitraryLane((NormallyLane & ~wipLanes) as Lane);
            if(lane === NotLane){
                return findUpdate(idleLanePriority,wipLanes)
            }
            return lane 
        case idleLanePriority:
            var lane = pickArbitraryLane((idleLane & ~wipLanes) as Lane);
            return lane;
    }
}



//标记fiberRoot
//目前先简单实现
export const markRootUpdated = function(root:FiberRoot,lane:Lane){   
    root.pendingLane |= lane;
}
//目前先简单实现
export const markRootFinished = function(root:FiberRoot,remainingLane:Lane){
    root.pendingLane = remainingLane;
}
//目前先简单实现,处理过期任务,暂时未使用
export const markStarvedLanesAsExpired = function(root:FiberRoot, currentTime: number){
    const pendingLanes = root.pendingLane;
    const expirationTimes = root.expirationTimes;
    let lanes = pendingLanes;
    while (lanes > 0) {
        //从高到低计算
        const index = pickArbitraryLaneIndex(lanes);
        const lane = 1 << index;
        const expirationTime = expirationTimes[index];
        if(expirationTime <= currentTime) {
            //找到超时的
            root.expirationLane |= lane;
        }
        lanes &= ~lane;
    }
}
//目前先简单实现
export const resetChildLanes = function(completedWork: Fiber){
    //隐藏的先不处理
    if((completedWork.tag === OffscreenComponent) && completedWork.memoizedState){
        return 
    }
    let newChildLanes = NotLane;
    let child = completedWork.children;
    while (child) {
        newChildLanes = (newChildLanes |(child.lane|child.childrenLane));
        child = child.sibling;
    }
    completedWork.childrenLane = newChildLanes as Lane;
}

