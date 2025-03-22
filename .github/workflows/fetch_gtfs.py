import requests
from google.transit import gtfs_realtime_pb2

GTFS_RT_URL = "https://YOUR_GTFS_RT_FEED_URL"

def fetch_gtfs_rt():
    response = requests.get(GTFS_RT_URL)
    if response.status_code == 200:
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)
        
        with open("gtfs_realtime.pb", "wb") as f:
            f.write(response.content)
        print("GTFS-RT data saved.")
    else:
        print(f"Failed to fetch GTFS-RT data: {response.status_code}")

fetch_gtfs_rt()
