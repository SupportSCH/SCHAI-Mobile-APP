import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/Camera/ngx';
import { ActionSheetController, ToastController, Platform, LoadingController, NavController, Events, IonSelect } from '@ionic/angular';
import { File, FileEntry } from '@ionic-native/File/ngx';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { Storage } from '@ionic/storage';
import { FilePath } from '@ionic-native/file-path/ngx';
import { finalize } from 'rxjs/operators';

const STORAGE_KEY = 'my_images';

@Component({
  selector: 'app-classify',
  templateUrl: './classify.page.html',
  styleUrls: ['./classify.page.scss'],
})
export class ClassifyPage implements OnInit {

  images: any = [];

  image: any;

  status_text: any = "Upload an Image";

  UploadStatus: boolean = false;

  folder_name_array: any = [];
  folder_name: any;

  Base_URL: any = "http://172.16.16.111/matlab/";


  @ViewChild('mySelect') selectRef: IonSelect;
  
  constructor(public events: Events,private platform: Platform, private camera: Camera, private file: File, private http: HttpClient, private webview: WebView,
    private actionSheetController: ActionSheetController, private toastController: ToastController,
    private storage: Storage, private plt: Platform, private loadingController: LoadingController,
    private ref: ChangeDetectorRef, private filePath: FilePath, private nav: NavController) { }

  ngOnInit() {
    this.getFolderNames();
    this.plt.ready().then(() => {
      // this.loadStoredImages();
    });
  }

  openSelect()
  {
      this.selectRef.open();
  }

  ionChange() {
    this.presentToast('Updated Successfully!')
  }

  loadStoredImages() {
    this.storage.get(STORAGE_KEY).then(images => {
      if (images) {
        let arr = JSON.parse(images);
        this.images = [];

        for (let img of arr) {
          let filePath = this.file.dataDirectory + img;
          let resPath = this.pathForImage(filePath);
          this.images.push({ name: img, path: resPath, filePath: filePath });
        }

      }
    });
  }

  async getFolderNames() {
    const loading = await this.loadingController.create({
      message: "loading Biscuit Type..."
    });
    await loading.present();
    this.folder_name_array = [];

    this.http.get(this.Base_URL + 'img_upload/api/get_folder.php')
      .subscribe((response) => {
        this.folder_name_array =  response;
        loading.dismiss();
      })
  }

  pathForImage(img) {
    if (img === null) {
      return '';
    } else {
      let converted = this.webview.convertFileSrc(img);
      return converted;
    }
  }

  async presentToast(text) {
    const toast = await this.toastController.create({
      message: text,
      position: 'bottom',
      duration: 3000
    });
    toast.present();
  }

  async selectImage() {
    this.takePicture(this.camera.PictureSourceType.CAMERA);
  }

  takePicture(sourceType: PictureSourceType) {
    var options: CameraOptions = {
      quality: 100,
      sourceType: sourceType,
      encodingType: this.camera.EncodingType.JPEG,
      // destinationType: this.camera.DestinationType.DATA_URL,
      targetWidth: 1920,
      targetHeight: 1080,
      saveToPhotoAlbum: false,
      correctOrientation: true
    };

    this.camera.getPicture(options).then(imagePath => {
      var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
      var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
      this.copyFileToLocalDir(correctPath, currentName, this.createFileName());

      this.file.readAsDataURL(correctPath, currentName).then(res => { this.image = res });
    });
  }

  copyFileToLocalDir(namePath, currentName, newFileName) {
    this.file.copyFile(namePath, currentName, this.file.dataDirectory, newFileName).then(success => {
      this.updateStoredImages(newFileName);
    }, error => {
      this.presentToast('Error while storing file.');
    });
  }

  createFileName() {
    var d = new Date(),
      n = d.getTime(),
      newFileName = n + ".jpg";
    return newFileName;
  }

  updateStoredImages(name) {

    this.storage.get(STORAGE_KEY).then(images => {
      let arr = JSON.parse(images);
      if (!arr) {
        let newImages = [name];
        this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
      } else {
        arr.push(name);
        this.storage.set(STORAGE_KEY, JSON.stringify(arr));
      }

      let filePath = this.file.dataDirectory + name;
      let resPath = this.pathForImage(filePath);

      let newEntry = {
        name: name,
        path: resPath,
        filePath: filePath
      };

      this.images = [newEntry];
      this.ref.detectChanges(); // trigger change detection cycle
    });
  }

  deleteImage(imgEntry, position) {

    this.images.splice(position, 1);

    this.storage.get(STORAGE_KEY).then(images => {
      let arr = JSON.parse(images);
      let filtered = arr.filter(name => name != imgEntry.name);
      this.storage.set(STORAGE_KEY, JSON.stringify(filtered));
      var correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);
      this.file.removeFile(correctPath, imgEntry.name).then(res => {
        this.UploadStatus = true;
      });
    });
  }

  startUpload() {
    this.file.resolveLocalFilesystemUrl(this.images[0].filePath)
      .then(entry => {
        (<FileEntry>entry).file(file => this.readFile(file))
      })
      .catch(err => {
        this.presentToast('Error while reading file.');
      });
  }

  readFile(file: any) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const formData = new FormData();
      const imgBlob = new Blob([reader.result], {
        type: file.type
      });
      formData.append('image', imgBlob, file.name);
      // formData.append('folder_name', this.folder_name);
      this.uploadImageData(formData);
    };
    reader.readAsArrayBuffer(file);
  }

  async uploadImageData(formData: FormData) {
    const loading = await this.loadingController.create({
      message: "Uploading Image..."
    });
    await loading.present();

    this.http.post('http://172.16.16.111/matlab/getMatlabInfo.php', formData)
      .pipe(
        finalize(() => {
          loading.dismiss();
        })
      )
      .subscribe((res: any) => {
        console.log(res);
        if (res.resp_code == 1) {
          this.status_text = res.status;
          this.UploadStatus = true;
          this.presentToast(res.status);
          this.deleteImage(this.images[0], 0);
        }
      });
  }

  doRefresh(event) {
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }

  refresh() {
    this.presentToast('Updated Successfully!')
    this.UploadStatus = false;
    this.image = "";
    this.status_text = "Upload an Image"
  }



}
