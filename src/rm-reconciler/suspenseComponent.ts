import { 
    Fiber,
    createWorkProcess as createCloneFiber,
    noModel,BlockModel,
    NotEffect,PlaceEffect,incompleteEffect,DidCaptureEffect,
    OffscreenComponent,FragmentComponent, DeleteEffect,
} from './Fiber'
import { NotLane,Lane } from './Lane'
import { createWorkProcess } from './workProcess'


export const shouldRemainOnFallback = function(
    current: null | Fiber,
    workInProgress: Fiber,
):boolean{
    if (current !== null) {
        const suspenseState= current.memoizedState;
        if (suspenseState === null) {
            return false;
        }
    }
    return true;
}

//简化处理了
export const shouldCaptureSuspense = function(workProgress:Fiber){
    const nextState = workProgress.memoizedState;
    if (nextState !== null) {
        return false;
    }
    const props = workProgress.memoizedProps;
    if (props.fallback === undefined) {
        return false;
    }
    return true
}


export const getRemainingWorkInPrimaryTree = function(workProgress:Fiber,lane:Lane):Lane{
    return (workProgress.childrenLane & ~lane) as Lane
}

export const mountSuspenseFallbackChildren = function(
    workInProgress:Fiber,
    primaryChildren:any,
    fallbackChildren:any,
    lane:Lane,
){   
    const mode = workInProgress.mode
    const progressedPrimaryFragment: Fiber | null = workInProgress.children;
    const primaryChildProps = {
        mode: 'hidden',
        children: primaryChildren,
    }
    let primaryChildFragment;
    let fallbackChildFragment;
    //block遗留过度模式的问题
    // if((mode & BlockModel) === noModel && progressedPrimaryFragment){
        // console.error('Suspense block 模式下好像处理不太一样')
        // primaryChildFragment = progressedPrimaryFragment;
        // primaryChildFragment.childLanes = NotLane;
        // primaryChildFragment.pendingProps = primaryChildProps;
        // //fallbackChildFragment
        // fallbackChildFragment = new Fiber(FragmentComponent)
        // fallbackChildFragment.type = null;
        // fallbackChildFragment.children = fallbackChildren
        // fallbackChildFragment.lane = lane;
    // }else{
        //fallbackChildFragment
        fallbackChildFragment = new Fiber(FragmentComponent,workInProgress.mode)
        fallbackChildFragment.type = null;
        fallbackChildFragment.pendingProps = fallbackChildren
        fallbackChildFragment.lane = lane;
        //primaryChildFragment
        primaryChildFragment = new Fiber(OffscreenComponent,workInProgress.mode)
        primaryChildFragment.type = null;
        primaryChildFragment.pendingProps = primaryChildProps
        primaryChildFragment.lane = NotLane;
    // }
    //创建关系
    primaryChildFragment.return = workInProgress;
    fallbackChildFragment.return = workInProgress;
    primaryChildFragment.sibling = fallbackChildFragment;
    workInProgress.children = primaryChildFragment;
    return fallbackChildFragment;
}
export const updateSuspenseFallbackChildren = function(
    current,
    workInProgress,
    primaryChildren,
    fallbackChildren,
    renderLanes,
){
    const mode = workInProgress.mode;
    const currentPrimaryChildFragment: Fiber = (current.children as any);
    const currentFallbackChildFragment: Fiber | null =
      currentPrimaryChildFragment.sibling;
  
    const primaryChildProps = {
        mode: 'hidden',
        children: primaryChildren,
    };
    let primaryChildFragment;

    // (mode & BlockingMode) === NoMode  block模式先不处理
    primaryChildFragment = createWorkProcess(
        currentPrimaryChildFragment,
        primaryChildProps,
    );
    let fallbackChildFragment;
    if (currentFallbackChildFragment) {
        fallbackChildFragment = createWorkProcess(
            currentFallbackChildFragment,
            fallbackChildren,
        );
    } else {
        fallbackChildFragment = new Fiber(FragmentComponent,workInProgress.mode)
        fallbackChildFragment.type = null;
        fallbackChildFragment.pendingProps = fallbackChildren
        fallbackChildFragment.lane = renderLanes;
        // Needs a placement effect because the parent (the Suspense boundary) already
        // mounted but this is a new fiber.
        fallbackChildFragment.flags |= PlaceEffect;
    }

    fallbackChildFragment.return = workInProgress;
    primaryChildFragment.return = workInProgress;
    primaryChildFragment.sibling = fallbackChildFragment;
    workInProgress.child = primaryChildFragment;

    return fallbackChildFragment;
}


export const mountSuspenseOffscreenState = function(lane:Lane){
    return {
        baseLanes:lane
    }
}
export const updateSuspenseOffscreenState = function( prevOffscreenState: { baseLanes:Lane },renderLanes: Lane,){
    return {
        baseLanes: (prevOffscreenState.baseLanes | renderLanes)
    }
}


export const mountSuspensePrimaryChildren = function(
    workInProgress:Fiber,
    primaryChildren:any,
    renderLanes:Lane,
){
    const primaryChildProps = {
        mode: 'visible',
        children: primaryChildren,
    };
    const primaryChildFragment = new Fiber(OffscreenComponent,workInProgress.mode)
    primaryChildFragment.type = null;
    primaryChildFragment.pendingProps = primaryChildProps
    primaryChildFragment.lane = NotLane
    primaryChildFragment.return = workInProgress;
    workInProgress.children = primaryChildFragment;
    return primaryChildFragment;
}
export const updateSuspensePrimaryChildren = function(  
    current,
    workInProgress,
    primaryChildren,
    renderLanes
){
    const currentPrimaryChildFragment: Fiber = (current.children as any);
    const currentFallbackChildFragment: Fiber | null = currentPrimaryChildFragment.sibling;
    const primaryChildFragment = createWorkProcess(
      currentPrimaryChildFragment,
      {
        mode: 'visible',
        children: primaryChildren,
      },
    );
    // block模式先不处理
    // if ((workInProgress.mode & BlockingMode) === NoMode) {
    //   primaryChildFragment.lanes = renderLanes;
    // }
    primaryChildFragment.return = workInProgress;
    primaryChildFragment.sibling = null;
    if (currentFallbackChildFragment) {
      // 删除fallBack组件
      currentFallbackChildFragment.nextEffect = null;
      currentFallbackChildFragment.flag = DeleteEffect;
      workInProgress.firstEffect = workInProgress.lastEffect = currentFallbackChildFragment;
    }
    workInProgress.child = primaryChildFragment;
    return primaryChildFragment;
}
