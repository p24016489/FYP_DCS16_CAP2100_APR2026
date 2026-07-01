import requests

# 1. The URL of your new API endpoint
url = 'http://127.0.0.1:8000/api/inspect/'

# 2. Put a test PCB image in your project folder and name it 'test.jpg'
image_path = 'img13.jpg' 

try:
    with open(image_path, 'rb') as image_file:
        files = {'image': image_file}
        print("Sending image to YOLO backend...")
        
        # 3. Send the POST request
        response = requests.post(url, files=files)
        
        # 4. Print the AI's results!
        print("\n--- YOLO RESULTS ---")
        print(response.json())
        
except FileNotFoundError:
    print(f"Error: Could not find '{image_path}'. Make sure you put a test image in the folder!")