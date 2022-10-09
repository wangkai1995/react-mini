var scheduledHostCallback = null
var isMessageLoopRunning = false;
var deadline = 0;
var yieldInterval = 5;

const localDate = Date;
const initialTime = localDate.now();
export const getCurrentTime = ()=>localDate.now() - initialTime;
const performWorkUntilDeadline = () => {
    if (scheduledHostCallback !== null) {
        const currentTime = getCurrentTime();
        deadline = currentTime + yieldInterval;
        try {
            const hasMoreWork = scheduledHostCallback(currentTime);
            if (!hasMoreWork) {
                isMessageLoopRunning = false;
                scheduledHostCallback = null;
            } else {
                port.postMessage(null);
            }
        } catch (error) {
            throw error;
        }
    } else {
        isMessageLoopRunning = false;
    }
};


const channel = new MessageChannel();
const port = channel.port2;
channel.port1.onmessage = performWorkUntilDeadline;


export const requestHostCallback = function (callback) {
    scheduledHostCallback = callback;
    if (!isMessageLoopRunning) {
        isMessageLoopRunning = true;
        port.postMessage(null);
    }
};
export const cancelHostCallback = function () {
    scheduledHostCallback = null;
};
export const shouldYieldToHost = function () {
    return getCurrentTime() >= deadline;
};


