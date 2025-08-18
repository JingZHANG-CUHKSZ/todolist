# 群组数据存储

这个文件夹用于存储各个群组的任务数据。

每个群组的数据存储格式：`group-{群组ID}.json`

数据结构：
```json
{
  "group": {
    "id": "群组ID",
    "name": "群组名称", 
    "createdAt": "创建时间",
    "createdBy": "创建者"
  },
  "tasks": [
    {
      "id": "任务ID",
      "text": "任务内容",
      "completed": false,
      "createdAt": "创建时间",
      "createdBy": "创建者"
    }
  ],
  "lastUpdated": "最后更新时间"
}
```
