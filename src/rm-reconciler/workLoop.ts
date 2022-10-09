import { 
    FiberRoot,Fiber,
    StackCursor,
    pushStack,
    popStack
} from './Fiber'
import { 
    Lane,getNextLanes,laneToLanePriority,markRootUpdated,lanePriorityToShedulerPriority,
    NotLane,SyncLane,SyncBatchLane,
    syncBatchLanePriority,notLanePriority 
} from './Lane'
import { 
    getUpdateContext,setUpdateContext,
    NoUpdatetContext,CommitContext,SynUpdateContext,RenderContext
 } from './update'
import { flushPassiveEffects } from './hookEffect'
import { handleError } from './throwError'
import { 
    getWorkProcessRoot,setWorkProcessRoot,
    getWorkProcess,setWorkProcess,
    createWorkProcess,
    beginWork,completeUnitOfWork,
} from './workProcess'
import { 
    shedulerCallBack,
    cancelShedulerCallback,
    shedulerSynCallBack,
    flushSyncCallbackQueue,
    scheduler_shouldYield 
} from './schedulerWithReconciler'
import { commitRoot } from './workCommit'

export type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5;
export const RootIncomplete = 0;
export const RootFatalErrored = 1;
export const RootErrored = 2;
export const RootSuspended = 3;
export const RootSuspendedWithDelay = 4;
export const RootCompleted = 5;


var subtreeRenderLanes:Lane = NotLane
var workInProgressRootExitStatus:RootExitStatus = RootIncomplete
var workInProgressRootIncludedLanes:Lane = NotLane
var workInProgressRootRenderLanes:Lane = NotLane
const subtreeRenderLanesCursor: StackCursor<Lane> = {current:NotLane};
export function pushRenderLanes(fiber: Fiber, lanes: Lane) {
    pushStack(subtreeRenderLanesCursor, subtreeRenderLanes, fiber);
    subtreeRenderLanes |= lanes
    workInProgressRootIncludedLanes |= lanes
}
export function popRenderLanes(fiber: Fiber) {
    subtreeRenderLanes = subtreeRenderLanesCursor.current;
    popStack(subtreeRenderLanesCursor, fiber);
}
export function getSubtreeRenderLanes(){
    return subtreeRenderLanes
}
export function getWorkInProgressRootRenderLanes(){
    return workInProgressRootRenderLanes
}
export function setWorkInProgressRootRenderLanes(lane:Lane){
    workInProgressRootRenderLanes = lane;
}
export function getWorkInProgressRootExitStatus(){
    return workInProgressRootExitStatus
}
export function setWorkInProgressRootExitStatus(status:RootExitStatus){
    workInProgressRootExitStatus = status
}


export function prepareFreshStack(root:FiberRoot,lane:Lane){
    root.finishedWork = null;
    //如果当前存在WorkProces，说明出现优先级替换
    const workProces = getWorkProcess()
    if(workProces){
        console.log('如果当前存在WorkProces，说明需要中断')
        let interruptedWork = workProces.return;
        while (interruptedWork !== null) {
            //暂时没有处理上下文context
            // unwindInterruptedWork(interruptedWork);
            interruptedWork = interruptedWork.return;
        }
    }
    //重新设置参数
    subtreeRenderLanes = lane;
    workInProgressRootIncludedLanes = lane;
    workInProgressRootRenderLanes = lane;
    workInProgressRootExitStatus = RootIncomplete;
    setWorkProcessRoot(root)
    setWorkProcess(createWorkProcess(root.current))
}


//标记root的更新优先级，设置先关的属性,和lane更新相关,Lane相关先不实现
//处理childrenLane变量，将下面的更新提升到root,Lane相关先不实现
export const markUpdateLaneFromFiberToRoot = function(fiber:Fiber,lane:Lane):FiberRoot{
    var current = fiber
    //更新当前节点的lane
    current.lane |= lane
    if(current.alternate){
        current.alternate.lane |= lane;
    }
    //从当前节点向上提升childLane
    var parent = current.return
    while(parent){
        current = (parent as Fiber)
        current.childrenLane |= lane
        if(current.alternate){
            current.alternate.childrenLane |= lane;
        }
        parent = parent.return
    }
    const root = current.stateNode as FiberRoot
    return root;
}

//根据副作用进行调度更新
export const scheduleUpdateOnFiber = function(fiber:Fiber,lane:Lane){
    const UpdateContext = getUpdateContext();
    const root = markUpdateLaneFromFiberToRoot(fiber,lane)
    markRootUpdated(root,lane)
    //同步任务
    if(lane === SyncLane){
        //同步执行  commit阶段或者挂载
        if( (UpdateContext & (CommitContext|SynUpdateContext)) !== NoUpdatetContext ){
            shedulerSynCallBack(()=>{
                performSyncWorkOnRoot(root,lane)
            })
        }else{
            ensureRootIsScheduled(root)
            if(UpdateContext === NoUpdatetContext){
                //没有上下文，类似无动作的情况在setTimeout里面 设置setState,此时需要同步的执行每一个setState
                flushSyncCallbackQueue();
            }
        }
    }else{
        ensureRootIsScheduled(root)
    }  
}


//检查lane过期情况，
//检查优先级，进行优先级插队
//选择执行callback进入调度,进入时间分片队列
export const ensureRootIsScheduled = function(root:FiberRoot){
    const existCallback = root.callback
    const nextLane = getNextLanes(root,root === getWorkProcessRoot() ? workInProgressRootIncludedLanes : NotLane);
    const nextLanePriority = laneToLanePriority(nextLane as Lane)
    //取消当前任务
    if(nextLane === NotLane){
        //如果当前没任务,并且存在任务，需要清除掉
        if(existCallback){
            cancelShedulerCallback(existCallback)
            root.callback = null;
            root.callbackPriority = notLanePriority
        }
        return 
    }
    //如果存在,需要检查，当前优先级是否有变化，如果没变化，则复用,
    if(existCallback){
        //复用优先级
        if(nextLanePriority === root.callbackPriority){
            return 
        }
        cancelShedulerCallback(existCallback)
    } 
    //开始根据优先级执行
    let newCallback
    if(nextLane === SyncLane){
        newCallback =  shedulerSynCallBack(()=>{
            performSyncWorkOnRoot(root,SyncLane)
        })
    }else if(nextLane === SyncBatchLane){
        const shedulerPriority = lanePriorityToShedulerPriority(syncBatchLanePriority)
        newCallback = shedulerCallBack(shedulerPriority,()=>{   
            return performSyncWorkOnRoot(root,nextLane)  
        })  
    }else{
        const shedulerPriority = lanePriorityToShedulerPriority(nextLanePriority)
        newCallback = shedulerCallBack(shedulerPriority,()=>{   
            return performConcurrentWorkOnRoot(root)
        })  
    }
    root.callback  = newCallback;
    root.callbackPriority = nextLanePriority
}

//执行任务
export const performUnitOfWork = function(workProcess:Fiber){
    var current = workProcess.alternate
    var next = beginWork(current, workProcess,subtreeRenderLanes);
    workProcess.memoizedProps = workProcess.pendingProps;
    if (!next) {
        completeUnitOfWork(workProcess);
    } else {
        setWorkProcess(next)
    }
}

//同步渲染Root
export const renderRootSync =function(root:FiberRoot,lane:Lane){
    if(getWorkProcessRoot() !== root){
        prepareFreshStack(root,lane)
    }
    //开始渲染
    do{
        try {
            while (getWorkProcess()) {
                performUnitOfWork(getWorkProcess());
            }
            break;
        } catch (thrownValue) {
            handleError(root,thrownValue)
        }
    }while(true)
    //更新完成清除当前任务
    setWorkProcessRoot(null);
    workInProgressRootRenderLanes = NotLane;
    return RootCompleted
}

//开始执行同步更新任务
export const performSyncWorkOnRoot = function(root:FiberRoot,lane:Lane){
    //处理离散的副作用
    flushPassiveEffects();
    //同步diff阶段
    //exitStatus和suspension有关系，先不处理
    const exitStatus = renderRootSync(root,lane);
    //commit阶段
    const finishedWork: Fiber = (root.current.alternate);
    root.finishedWork = finishedWork;
    commitRoot(root);
    return exitStatus
}

/* 并发渲染模式 */

//执行并发任务
//目前这里存在一个问题 在react 18里面修复了，就是工作时间过长，tree巨大的情况下，需要使用同步的，不然并发渲染会导致无限的死循环
//scheduler_shouldYield生效,导致root.callback === originalCallbackNode,并且sheduler的currentTask.expirationTime > currentTime失效
export const performConcurrentWorkOnRoot = function(root:FiberRoot){
    const originalCallbackNode = root.callback;
    const didFlushPassiveEffects = flushPassiveEffects();
    if (didFlushPassiveEffects) {
        //执行一下副作用,如果副作用导致更高优先级执行ensureRootIsScheduled,需要中止本次渲染
        if (root.callback !== originalCallbackNode) {
            return null;
        }
    }
    //计算lane
    let lanes = getNextLanes(
        root,
        root === getWorkProcessRoot() ? workInProgressRootRenderLanes : NotLane,
    ) as Lane;
    //预防性的, 如果没更新了 要退出，避免originalCallbackNode === root.callback === null 出现死循环 
    if (lanes === NotLane) {
        return null;
    }
    //执行并行渲染
    const exitStatus = renderRootConcurrent(root,lanes)
    //是否完成
    if(exitStatus !== RootIncomplete){
        //错误情况先不处理，RootFatalErrored相关 RootErrored相关
        const finishedWork: Fiber = (root.current.alternate);
        root.finishedWork = finishedWork;
        //finishConcurrentRender先简化处理
        commitRoot(root);
    }
    ensureRootIsScheduled(root);
    if (root.callback === originalCallbackNode) {
        //返回自己，继续执行
        return performConcurrentWorkOnRoot.bind(null, root);
    }
    return null;
}

//并发渲染
export const renderRootConcurrent = function(root: FiberRoot, lane: Lane){
    var executionContext = getUpdateContext();
    var prevExecutionContext = executionContext;
    executionContext |= RenderContext;
    setUpdateContext(executionContext)
    //准备开始调度
    if(getWorkProcessRoot() !== root || workInProgressRootRenderLanes!==lane){
        prepareFreshStack(root,lane)
    }
    do {
        try {
            while (getWorkProcess() && !scheduler_shouldYield()) {
                performUnitOfWork(getWorkProcess());
            }
            break;
        } catch (thrownValue) {
            handleError(root, thrownValue);
        }
    } while (true);
    setUpdateContext(prevExecutionContext)
    
    //检查当前分片执行是否结束
    if(getWorkProcess()){
        //未结束
        return RootIncomplete;
    }else{
        //已经结束了
        setWorkProcessRoot(null)
        workInProgressRootRenderLanes = NotLane;
        return workInProgressRootExitStatus;
    }
}

