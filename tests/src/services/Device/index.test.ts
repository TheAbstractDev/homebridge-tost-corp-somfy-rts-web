import "jest-extended";
import ApiClient from "../../../../src/services/ApiClient";
import Device from "../../../../src/services/Device";
import { DeviceEvent, DeviceState } from "../../../../src/services/Device/types";

function createDevice() {
  const api = new ApiClient({ id: "DEVICE_ID" });

  jest.spyOn(api, "init").mockResolvedValue(undefined);
  jest.spyOn(api, "action").mockResolvedValue(undefined);

  const device = new Device({
    api,
    name: "Name 1",
    topic: "topic_1",
    duration: 1,
  });

  return { api, device };
}

describe("getState", () => {
  test("it returns the current state", () => {
    const { device } = createDevice();

    device["state"] = DeviceState.INCREASING;

    expect(device.getState()).toBe(DeviceState.INCREASING);
  });
});

describe("getPosition", () => {
  test("it returns the current position", () => {
    const { device } = createDevice();

    device["position"] = 42;

    expect(device.getPosition()).toBe(42);
  });
});

describe("handleStateChange", () => {
  test("it should emit event", () => {
    const { device } = createDevice();
    const mockHandler = jest.fn();

    device.on(DeviceEvent.STATE_CHANGE, mockHandler);
    device["handleStateChange"](DeviceState.DECREASING);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        value: DeviceState.DECREASING,
      })
    );
  });
});

describe("handlePositionChange", () => {
  test("it should emit event with a rounded evalue", () => {
    const { device } = createDevice();
    const mockHandler = jest.fn();

    device.on(DeviceEvent.POSITION_CHANGE, mockHandler);
    device["handlePositionChange"](42.42);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 42,
      })
    );
  });

  test("it should emit event with a value clamped to 100", () => {
    const { device } = createDevice();
    const mockEmit = jest.spyOn(device, "emit");

    device["handlePositionChange"](142.42);

    expect(mockEmit).toHaveBeenCalledWith(
      DeviceEvent.POSITION_CHANGE,
      expect.objectContaining({
        value: 100,
      })
    );
  });

  test("it should emit event with a value clamped to 0", () => {
    const { device } = createDevice();
    const mockEmit = jest.spyOn(device, "emit");

    device["handlePositionChange"](-42.42);

    expect(mockEmit).toHaveBeenCalledWith(
      DeviceEvent.POSITION_CHANGE,
      expect.objectContaining({
        value: 0,
      })
    );
  });
});

describe("up", () => {
  test("it should call action to increase", async () => {
    const { device, api } = createDevice();
    const mockAction = jest.spyOn(api, "action");
    const mockHandleChange = jest
      .spyOn(device as any, "handleStateChange")
      .mockReturnValue(undefined);

    await device.up();

    expect(mockAction).toHaveBeenCalledWith({
      action: "up",
      topic: "topic_1",
    });

    expect(mockHandleChange).toHaveBeenCalledWith(DeviceState.INCREASING);
  });
});

describe("down", () => {
  test("it should call action to decrease", async () => {
    const { device, api } = createDevice();
    const mockAction = jest.spyOn(api, "action");
    const mockHandleChange = jest
      .spyOn(device as any, "handleStateChange")
      .mockReturnValue(undefined);

    await device.down();

    expect(mockAction).toHaveBeenCalledWith({
      action: "down",
      topic: "topic_1",
    });

    expect(mockHandleChange).toHaveBeenCalledWith(DeviceState.DECREASING);
  });
});

describe("stop", () => {
  test("it should not stop; position === 0", async () => {
    const { device, api } = createDevice();
    const mockAction = jest.spyOn(api, "action");
    const mockHandleChange = jest
      .spyOn(device as any, "handleStateChange")
      .mockReturnValue(undefined);

    device["position"] = 0;

    await device.stop();

    expect(mockAction).not.toHaveBeenCalled();
    expect(mockHandleChange).toHaveBeenCalledWith(DeviceState.STOPPED);
  });

  test("it should not stop; position === 100", async () => {
    const { device, api } = createDevice();
    const mockAction = jest.spyOn(api, "action");
    const mockHandleChange = jest
      .spyOn(device as any, "handleStateChange")
      .mockReturnValue(undefined);

    device["position"] = 100;

    await device.stop();

    expect(mockAction).not.toHaveBeenCalled();
    expect(mockHandleChange).toHaveBeenCalledWith(DeviceState.STOPPED);
  });

  test("it should stop", async () => {
    const { device, api } = createDevice();
    const mockAction = jest.spyOn(api, "action");
    const mockHandleChange = jest
      .spyOn(device as any, "handleStateChange")
      .mockReturnValue(undefined);

    device["position"] = 42;

    await device.stop();

    expect(mockAction).toHaveBeenCalledWith({
      action: "stop",
      topic: "topic_1",
    });

    expect(mockHandleChange).toHaveBeenCalledWith(DeviceState.STOPPED);
  });
});

describe("setPosition", () => {
  jest.useFakeTimers();

  test("it should do nothing; difference === 0, position in ]0, 100[", async () => {
    const { device } = createDevice();
    const mockCancelUpdate = jest.spyOn(device as any, "cancelUpdate");
    const mockUp = jest.spyOn(device as any, "up");
    const mockDown = jest.spyOn(device as any, "down");
    const mockHandlePositionChange = jest.spyOn(device as any, "handlePositionChange");

    device["position"] = 42;
    await device.setPosition(42);

    expect(mockCancelUpdate).toHaveBeenCalled();
    expect(mockUp).not.toHaveBeenCalled();
    expect(mockDown).not.toHaveBeenCalled();
    expect(mockHandlePositionChange).not.toHaveBeenCalled();
  });

  test("it should decrease even if position === 0", async () => {
    const { device } = createDevice();
    const mockCancelUpdate = jest.spyOn(device as any, "cancelUpdate");
    const mockDown = jest.spyOn(device as any, "down");
    const mockHandlePositionChange = jest.spyOn(device as any, "handlePositionChange");

    device["position"] = 0;
    await device.setPosition(0);

    expect(mockCancelUpdate).toHaveBeenCalled();
    expect(mockDown).toHaveBeenCalled();
    expect(mockHandlePositionChange).not.toHaveBeenCalled();
  });

  test("it should increase even if position === 100", async () => {
    const { device } = createDevice();
    const mockCancelUpdate = jest.spyOn(device as any, "cancelUpdate");
    const mockUp = jest.spyOn(device as any, "up");
    const mockHandlePositionChange = jest.spyOn(device as any, "handlePositionChange");

    device["position"] = 100;
    await device.setPosition(100);

    expect(mockCancelUpdate).toHaveBeenCalled();
    expect(mockUp).toHaveBeenCalled();
    expect(mockHandlePositionChange).not.toHaveBeenCalled();
  });

  test.skip("it should increase and update position", async () => {
    const { device } = createDevice();
    const mockCancelUpdate = jest.spyOn(device as any, "cancelUpdate");
    const mockUp = jest.spyOn(device as any, "up");
    const mockStop = jest.spyOn(device as any, "stop");
    const mockHandlePositionChange = jest.spyOn(device as any, "handlePositionChange");
    const increment = 5;

    device["position"] = 42;
    device.setPosition(99);

    await new Promise((resolve) => process.nextTick(resolve));
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);

    expect(mockCancelUpdate).toHaveBeenCalledTimes(1);
    expect(mockHandlePositionChange).toHaveBeenCalledTimes(3);

    expect(mockUp).toHaveBeenCalledAfter(mockCancelUpdate as any);
    expect(mockHandlePositionChange).toHaveBeenCalledAfter(mockUp as any);
    expect(mockStop).toHaveBeenCalledAfter(mockHandlePositionChange as any);

    for (let i = 1; i <= 3; i++) {
      expect(mockHandlePositionChange).toHaveBeenNthCalledWith(i, 42 + i * increment);
    }
  });

  test.skip("it should increase and be cancelled", async () => {
    const { device } = createDevice();
    const mockCancelUpdate = jest.spyOn(device as any, "cancelUpdate");
    const mockUp = jest.spyOn(device as any, "up");
    const mockDown = jest.spyOn(device as any, "down");
    const mockStop = jest.spyOn(device as any, "stop");
    const mockHandlePositionChange = jest.spyOn(device as any, "handlePositionChange");

    device["position"] = 50;
    device.setPosition(99);

    await new Promise((resolve) => process.nextTick(resolve));
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);

    device.setPosition(50);

    await new Promise((resolve) => process.nextTick(resolve));
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);

    const invocationCallOrders = [
      mockCancelUpdate.mock.invocationCallOrder[0],
      mockUp.mock.invocationCallOrder[0],
      mockHandlePositionChange.mock.invocationCallOrder[0],
      mockHandlePositionChange.mock.invocationCallOrder[1],
      mockHandlePositionChange.mock.invocationCallOrder[2],
      mockCancelUpdate.mock.invocationCallOrder[1],
      mockDown.mock.invocationCallOrder[0],
      mockHandlePositionChange.mock.invocationCallOrder[3],
      mockHandlePositionChange.mock.invocationCallOrder[4],
      mockHandlePositionChange.mock.invocationCallOrder[5],
      mockStop.mock.invocationCallOrder[0],
    ];

    expect(mockCancelUpdate).toHaveBeenCalledTimes(2);
    expect(mockHandlePositionChange).toHaveBeenCalledTimes(6);
    expect(mockStop).toHaveBeenCalledTimes(1);

    for (let i = 1; i < invocationCallOrders.length; i++) {
      expect(invocationCallOrders[i]).toBeGreaterThan(invocationCallOrders[i - 1]);
    }
  });
});
